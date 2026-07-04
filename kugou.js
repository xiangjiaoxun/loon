/*
酷狗概念版全自动签到脚本 - 终极修复版
*/
const KEY_REQS = 'kg_concept_requests';
const KEY_EXPIRE = 'kg_concept_expire_date';

if (typeof $request !== 'undefined') {
    captureRequest();
} else {
    executeCheckIn();
}

function captureRequest() {
    let reqs = [];
    const saved = $persistentStore.read(KEY_REQS);
    if (saved) { try { reqs = JSON.parse(saved); } catch (e) {} }
    
    const exists = reqs.some(r => r.url === $request.url);
    if (!exists) {
        if (reqs.length >= 3) reqs.shift(); 
        reqs.push({
            url: $request.url,
            headers: $request.headers || {},
            body: $request.body || '',
            method: $request.method || 'POST'
        });
        $persistentStore.write(JSON.stringify(reqs), KEY_REQS);
    }
    $done({});
}

async function executeCheckIn() {
    const saved = $persistentStore.read(KEY_REQS);
    if (!saved) {
        $notification.post("酷狗自动签到结果", "", "签到失败，请重试。");
        $done();
        return;
    }

    let reqs = [];
    try { reqs = JSON.parse(saved); } catch (e) { $done(); return; }

    let isSuccess = false;
    let isAlready = false;
    let expireDateStr = "";

    for (let i = 0; i < reqs.length; i++) {
        const req = reqs[i];
        await new Promise((resolve) => {
            const options = { url: req.url, headers: req.headers, body: req.body };
            const callback = (error, response, data) => {
                if (!error && data) {
                    try {
                        const res = JSON.parse(data);
                        const resStr = JSON.stringify(res).toLowerCase();
                        
                        // 1. 提取并格式化会员有效期
                        let expireTime = res.expire || res.vip_end_time || (res.data && (res.data.expire || res.data.vip_end_time || res.data.expiration_time));
                        if (expireTime) {
                            const date = new Date(expireTime < 10000000000 ? expireTime * 1000 : expireTime);
                            if (!isNaN(date.getTime())) {
                                expireDateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
                                $persistentStore.write(expireDateStr, KEY_EXPIRE); // 存入缓存
                            }
                        }

                        // 2. 状态判定
                        if (resStr.includes("已签到") || resStr.includes("已经签到") || resStr.includes("重复") || res.code === 20011 || res.status === 20011) {
                            isAlready = true;
                        } else if (res.code === 0 || res.status === 0 || resStr.includes("成功")) {
                            isSuccess = true;
                        }
                    } catch (e) {
                        const rawStr = data.toLowerCase();
                        if (rawStr.includes("已签到") || rawStr.includes("今天") || rawStr.includes("已经")) isAlready = true;
                        else if (rawStr.includes("成功")) isSuccess = true;
                    }
                }
                resolve();
            };
            if (req.method.toUpperCase() === 'GET') {
                $httpClient.get(options, callback);
            } else {
                $httpClient.post(options, callback);
            }
        });
    }

    // 如果本次没拿到日期（比如重复签到时接口不返回日期），从本地缓存里取上一次的
    if (!expireDateStr) {
        expireDateStr = $persistentStore.read(KEY_EXPIRE) || "2026年激活成功";
    }

    // 3. 严格判定通知状态（今日已签到 优先于 成功）
    if (isAlready) {
        $notification.post("酷狗自动签到结果", "", `今日已签到，会员有效期为 ${expireDateStr}`);
    } else if (isSuccess) {
        $notification.post("酷狗自动签到结果", "", `签到成功，会员有效期为 ${expireDateStr}。`);
    } else {
        $notification.post("酷狗自动签到结果", "", "签到失败，请重试。");
    }
    $done();
}
