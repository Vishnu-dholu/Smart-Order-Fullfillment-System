import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
    scenarios: {
        warmup: { executor: 'constant-vus', vus: 20, duration: '15s' },
        spike: {
            executor: 'ramping-vus',
            startTime: '15s',
            startVUs: 20,
            stages: [
                { duration: '30s', target: 200 },
                { duration: '30s', target: 200 },
                { duration: '15s', target: 0 },
            ],
        },
    },
};

// We will pass the target URL dynamically from the bash script
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:8082/products';

const PRODUCT_IDS = [
    'd2a2f90f-0af3-4e56-98bb-e7279bfc8a72',
    '524a62c0-43ee-49a3-9dda-2a80398cdeba',
    'c193ad20-b449-4698-8ac0-3ee7365e805c',
    'aaa7b712-03d2-42a7-81cf-d21bc911cac1',
    'e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79',
    '27131e33-b13f-4d64-b2e1-e6e94d7ba339',
    '7c4cba32-ca97-4c8d-b74f-c2f433d2180a',
    '7bd55cb2-0574-46de-8ce1-a950f471d9a6'
];

export default function () {
    // Randomly pick a product ID to view
    const randomProductId = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];

    // Send a GET request (No payload needed for viewing inventory)
    let res = http.get(`${TARGET_URL}/${randomProductId}`);

    check(res, {
        'is status 200': (r) => r.status === 200,
    });

    if (res.status !== 200) {
        console.log(`Failed! Status: ${res.status} | Product: ${randomProductId}`);
    }

    sleep(1);
}
