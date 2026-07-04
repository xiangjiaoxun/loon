const KEY_REQS = 'kg_concept_requests';

// 解析 Loon UI 传入的设置参数
function getArgs() {
    const args = {};
    if (typeof $argument !== 'undefined' && $argument) {
        $argument.split(',').forEach(item => {
            const parts = item.split('=');
            if (parts.length === 2) args[parts[0].trim()] = parts[1].trim();
        });
    }
    return args;
}

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
        if (reqs.length >= 5) reqs.shift(); 
        reqs.push({
            url: $request.url,
            headers: $request.headers || {},
            body: $request.body || '',
            method: $request.method || 'POST'
        });
        $persistentStore.write(JSON.stringify(reqs), KEY_REQS);
        
        // 解决缺点1：如果用户在UI里关闭了通知，或者已经抓过包了，就绝不弹窗轰炸
        const args = getArgs();
        if (args.capture_notify !== 'false') {
            $notification.post("酷狗概念版", "📌 成功捕获签到数据", "数据已存入本地，您现在可以去Loon设置中关闭【允许抓包成功提示】。");
        }
    }
    $done({});
}

async function executeCheckIn() {
    const saved = $persistentStore.read(KEY_REQS);
    if (!saved) {
        $notification.post("酷狗自动签到", "", "签到失败，请重试（未找到捕获数据）");
        $done();
        return;
    }

    let reqs = [];
    try { reqs = JSON.parse(saved); } catch (e) { $done(); return; }
    let results = [];

    for (let i = 0; i < reqs.length; i++) {
        const req = reqs[i];
        await new Promise((resolve) => {
            const options = { url: req.url, headers: req.headers, body: req.body };
            const callback = (error, response, data) => {
                if (error) {
                    results.push("签到失败，请重试");
                } else {
                    try {
                        const res = JSON.parse(data);
                        const resStr = JSON.stringify(res);
                        
                        // 解决缺点3：精准分流三种提示状态
                        if (resStr.includes("已签到") || resStr.includes("重复") || res.code === 20011 || res.status === 20011) {
                            results.push("今天已经签到");
                        } else if (res.code === 0 || res.status === 0 || resStr.includes("成功")) {
                            // 提取会员有效期
                            let expireDate = "未返回具体日期";
                            const expireTime = res.expire || res.vip_end_time || (res.data && (res.data.expire || res.data.vip_end_time || res.data.expiration_time));
                            if (expireTime) {
                                if (typeof expireTime === 'number') {
                                    const date = new Date(expireTime < 10000000000 ? expireTime * 1000 : expireTime);
                                    expireDate = date.toISOString().split('T')[0];
                                Reds} else {
                                    expireDate = expireTime;
                                }
                            }
                            results.push(`成功签到，会员有效期 ${expireDate}`);
                        } else {
                            results.push("签到失败，请重试");
                        }
                    } catch (e) {
                        if (data.includes("已签到") || data.includes("今天")) {
                            results.push("今天已经签到");
                        } else if (data.includes("成功")) {
                            results.push("成功签到，会员有效期已更新");
                        } else {
                            results.push("签到失败，请重试");
                        }
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

    // 过滤重复结果并弹窗
    const finalResults = [...new Set(results)];
    $notification.post("酷狗自动签到结果", "", finalResults.join('\n'));
    $done();
}
