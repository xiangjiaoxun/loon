/*
酷狗概念版全自动签到脚本 - 优化版
*/
const KEY_REQS = 'kg_concept_requests';

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
        
        // 解决Bug1：只有在第一次完全没数据时弹窗一次，后续默默收集，绝不轰炸
        if (reqs.length === 1) {
            $notification.post("酷狗概念版", "📌 成功捕获签到数据", "后续将完全静默运行，不会再弹窗打扰您。");
        }
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
                        const resStr = JSON.stringify(res);
                        
                        // 尝试解析会员有效期
                        let expireTime = res.expire || res.vip_end_time || (res.data && (res.data.expire || res.data.vip_end_time || res.data.expiration_time));
                        if (expireTime) {
                            const date = new Date(expireTime < 10000000000 ? expireTime * 1000 : expireTime);
                            if (!isNaN(date.getTime())) {
                                expireDateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
                            }
                        }

                        // 判断状态
                        if (resStr.includes("已签到") || resStr.includes("重复") || res.code === 20011 || res.status === 20011) {
                            isAlready = true;
                        } else if (res.code === 0 || res.status === 0 || resStr.includes("成功")) {
                            isSuccess = true;
                        }
                    } catch (e) {
                        if (data.includes("已签到") || data.includes("今天")) isAlready = true;
                        else if (data.includes("成功")) isSuccess = true;
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

    // 保底日期显示
    if (!expireDateStr) {
        expireDateStr = "已同步更新";
    }

    // 解决Bug3：严格按照用户要求的3种单一情况弹窗，一次只弹一个
    if (isSuccess) {
        $notification.post("酷狗自动签到结果", "", `签到成功，会员有效期为 ${expireDateStr}。`);
    } else if (isAlready) {
        $notification.post("酷狗自动签到结果", "", `签到失败，今日已签到，会员有效期为 ${expireDateStr}`);
    } else {
        $notification.post("酷狗自动签到结果", "", "签到失败，请重试。");
    }
    $done();
}
