// import { check, sleep } from 'k6';
// import http from 'k6/http';

// export const options = {
//     // P3-A: 35-minute staged load ramp
//     stages: [
//         { duration: '5m', target: 10 },   // Warm-up: Allow JIT compilation and pool initialization
//         { duration: '5m', target: 50 },   // Ramp 1: Light load
//         { duration: '5m', target: 100 },  // Ramp 2: Medium load
//         { duration: '5m', target: 200 },  // Ramp 3: Heavy load
//         { duration: '10m', target: 200 }, // Sustain: Observe steady-state memory and GC behaviour
//         { duration: '5m', target: 0 },    // Cool-down: Allow connections to drain gracefully
//     ],
//     // P3-B: Strict pass/fail thresholds
//     thresholds: {
//         http_req_duration: ['p(99)<500'], // 99% of requests must complete below 500ms
//         http_req_failed: ['rate<0.01'],   // Error rate must be strictly less than 1%
//     },
// };

// // Target URL passed dynamically from the bash script
// const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:8082/products';

// const PRODUCT_IDS = [
//     'd2a2f90f-0af3-4e56-98bb-e7279bfc8a72',
//     '524a62c0-43ee-49a3-9dda-2a80398cdeba',
//     'c193ad20-b449-4698-8ac0-3ee7365e805c',
//     'aaa7b712-03d2-42a7-81cf-d21bc911cac1',
//     'e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79',
//     '27131e33-b13f-4d64-b2e1-e6e94d7ba339',
//     '7c4cba32-ca97-4c8d-b74f-c2f433d2180a',
//     '7bd55cb2-0574-46de-8ce1-a950f471d9a6'
// ];

// export default function () {
//     // Randomly pick a product ID to view
//     const randomProductId = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];

//     // Send a GET request (No payload needed for viewing inventory)
//     let res = http.get(`${TARGET_URL}/${randomProductId}`);

//     // P3-B: Richer assertions
//     check(res, {
//         'is status 200': (r) => r.status === 200,
//         'response < 500ms': (r) => r.timings.duration < 500,
//         'no error in body': (r) => r.body && !String(r.body).toLowerCase().includes('error'),
//     });

//     if (res.status !== 200) {
//         console.log(`Failed! Status: ${res.status} | Product: ${randomProductId}`);
//     }

//     sleep(1);
// }




import { check, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';

export const options = {
    // Fast-Track Profile: 5 minutes total
    stages: [
        { duration: '30s', target: 10 },   // Warm-up
        { duration: '30s', target: 50 },   // Ramp 1
        { duration: '30s', target: 100 },  // Ramp 2
        { duration: '30s', target: 200 },  // Ramp 3
        { duration: '2m', target: 200 },  // Sustain
        { duration: '1m', target: 0 },    // Cool-down
    ],
    // SLA Thresholds
    thresholds: {
        http_req_duration: ['p(99)<500'], // 99% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],   // Error rate must be strictly less than 1%
    },
};

// Target URL passed dynamically from the bash script
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:8082/products';

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
    // Randomly pick a product ID to view
    // const randomProductId = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
    const randomProductId =
        PRODUCT_IDS[(exec.scenario.iterationInTest) % PRODUCT_IDS.length];

    // Send a GET request
    let res = http.get(`${TARGET_URL}/${randomProductId}`);

    // Rich Assertions
    check(res, {
        'is status 200': (r) => r.status === 200,
        'response < 500ms': (r) => r.timings.duration < 500,
        'no error in body': (r) => r.body && !String(r.body).toLowerCase().includes('error'),
    });

    if (res.status !== 200) {
        console.log(`Failed! Status: ${res.status} | Product: ${randomProductId}`);
    }

    sleep(1);
}
