/* 酷狗概念版 - 独立自动签到脚本 */
const KEY_REQS = 'kg_concept_requests_v3';
const KEY_EXPIRE = 'kg_concept_expire_date_v3';

async function executeCheckIn() {
    const saved = $persistentStore.read(KEY_REQS);
    if (!saved) {
        $notification.post("酷狗自动签到结果", "", "签到失败，请重试（未找到Cookie数据，请先进入活动页）");
        $done();
        return;
    }

    let reqs = JSON.parse(saved);
    let isSuccess = false;
    let isAlready = false;
    let expireDateStr = "";

    for (let i = 0; i < reqs.length; i++) {
        const req = reqs[i];
        await new Promise((resolve) => {
            const options = { url: req.url, headers: req.headers, body: req.body };
            const callback = (error, response, data) => {
                if (error) {
                    console.log(`[酷狗签到] 接口 ${i+1} 请求失败: ${error}`);
                } else if (data) {
                    console.log(`[酷狗签到] 接口 ${i+1} 返回数据: ${data}`);
                    try {
                        const res = JSON.parse(data);
                        const resStr = JSON.stringify(res);
                        
                        // 提取会员到期时间
                        let expireTime = res.expire || res.vip_end_time || (res.data && (res.data.expire || res.data.vip_end_time || res.data.expiration_time || res.data.rest_days));
                        if (expireTime) {
                            if (typeof expireTime === 'number' && expireTime < 1000) {
                                expireDateStr = `剩余 ${expireTime} 天`;
                            } else {
                                const date = new Date(expireTime < 10000000000 ? expireTime * 1000 : expireTime);
                                if (!isNaN(date.getTime())) {
                                    expireDateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
                                }
                            }
                            $persistentStore.write(expireDateStr, KEY_EXPIRE);
                        }

                        // 核心逻辑：精准捕捉重复签到状态
                        if (resStr.includes("已签到") || resStr.includes("已经签到") || resStr.includes("重复") || resStr.includes("今天已") || resStr.includes("checked") || resStr.includes("30005") || res.code === 20011 || res.status === 20011 || res.code === 30005 || res.code === 40003) {
                            isAlready = true;
                        } else if (res.code === 0 || res.status === 0 || res.code === 200 || resStr.includes("成功") || resStr.includes("ok")) {
                            isSuccess = true;
                        }
                    } catch (e) {
                        const rawStr = data.toLowerCase();
                        if (rawStr.includes("已签到") || rawStr.includes("今天") || rawStr.includes("已经") || rawStr.includes("repeat") || rawStr.includes("checked")) isAlready = true;
                        else if (rawStr.includes("成功") || rawStr.includes("ok")) isSuccess = true;
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

    if (!expireDateStr) {
        expireDateStr = $persistentStore.read(KEY_EXPIRE) || "已同步更新";
    }

    // 严格按要求分类通知：优先判定重复签到
    if (isAlready) {
        $notification.post("酷狗自动签到结果", "", `今日已签到，会员有效期为 ${expireDateStr}`);
    } else if (isSuccess) {
        $notification.post("酷狗自动签到结果", "", `签到成功，会员有效期为 ${expireDateStr}。`);
    } else {
        $notification.post("酷狗自动签到结果", "", "签到失败，请重试。");
    }
    $done();
}

executeCheckIn();
