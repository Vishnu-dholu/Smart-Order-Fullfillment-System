import { check, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';

// ==============================================================================
// RIGOROUS 35-MINUTE STAGED LOAD RAMP (ACTIVE)
// ==============================================================================
export const options = {
    scenarios: {
        warmup: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '5m', target: 10 },   // Warm-up: Allow JIT compilation and pool initialization
            ],
            gracefulRampDown: '10s',
            tags: { phase: 'warmup' },
        },
        measurement: {
            executor: 'ramping-vus',
            startVUs: 10,
            stages: [
                { duration: '5m', target: 50 },   // Ramp 1: Light load
                { duration: '5m', target: 100 },  // Ramp 2: Medium load
                { duration: '5m', target: 200 },  // Ramp 3: Heavy load
                { duration: '10m', target: 200 }, // Sustain: Observe steady-state memory and GC behaviour
                { duration: '5m', target: 0 },    // Cool-down: Allow connections to drain gracefully
            ],
            startTime: '5m',
            tags: { phase: 'measurement' },
        },
    },
    thresholds: {
        'http_req_duration{phase:measurement}': ['p(99)<500'], // 99% of requests must complete below 500ms
        'http_req_failed{phase:measurement}': ['rate<0.01'],   // Error rate must be strictly less than 1%
    },
};


// ==============================================================================
// FAST-TRACK PROFILE: 5 MINUTES TOTAL (COMMENTED OUT)
// ==============================================================================
// export const options = {
//     // Fast-Track Profile: 5 minutes total
//     stages: [
//         { duration: '30s', target: 10 },   // Warm-up
//         { duration: '30s', target: 50 },   // Ramp 1
//         { duration: '30s', target: 100 },  // Ramp 2
//         { duration: '30s', target: 200 },  // Ramp 3
//         { duration: '2m', target: 200 },  // Sustain
//         { duration: '1m', target: 0 },    // Cool-down
//     ],
//     // SLA Thresholds
//     thresholds: {
//         http_req_duration: ['p(99)<500'], // 99% of requests must complete below 500ms
//         http_req_failed: ['rate<0.01'],   // Error rate must be strictly less than 1%
//     },
// };

const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:8083/orders';
const USER_ID = __ENV.USER_ID || '96101f4b-b0ce-4178-9a38-b2720b1a097c';

// Array of products that currently have > 0 stock in the database
const PRODUCT_IDS = [
    'e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79',
    'a733e7b3-76f2-47af-81b0-33d2c35ffb10',
    'e2abc8a3-29d9-4f58-9c5a-ca1ffc38a6a0',
    '7bd55cb2-0574-46de-8ce1-a950f471d9a6',
    // 'aaa7b712-03d2-42a7-81cf-d21bc911cac1',
    'c529aca1-c634-4627-abfa-44a2de730499',
    '27131e33-b13f-4d64-b2e1-e6e94d7ba339',
    // '524a62c0-43ee-49a3-9dda-2a80398cdeba',
    'c193ad20-b449-4698-8ac0-3ee7365e805c',
    '7c4cba32-ca97-4c8d-b74f-c2f433d2180a',
    '3588af42-6f2c-4807-9167-8fa78861cac2',
    'd2a2f90f-0af3-4e56-98bb-e7279bfc8a72'
];

export default function () {
    // Randomly pick a product ID for this specific virtual user's order
    const randomProductId =
        PRODUCT_IDS[(exec.scenario.iterationInTest) % PRODUCT_IDS.length];

    const payload = JSON.stringify({
        shippingAddress: "123 Benchmark Ave, Load Test City",
        shippingLatitude: 12.9716,
        shippingLongitude: 77.5946,
        items: [
            {
                productId: randomProductId,
                quantity: 1
            }
        ]
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': USER_ID,
        },
    };

    let res = http.post(TARGET_URL, payload, params);

    // Rich Assertions
    check(res, {
        'is status 201': (r) => r.status === 201,
        'response < 500ms': (r) => r.timings.duration < 500,
        'no error in body': (r) => r.body && !String(r.body).toLowerCase().includes('error'),
    });

    // IF IT FAILS, TELL US WHY AND WHICH PRODUCT FAILED
    if (res.status !== 201) {
        console.error(JSON.stringify({
            status: res.status,
            product: randomProductId,
            body: res.body,
            duration: res.timings.duration
        }));
    }

    sleep(1);
}
