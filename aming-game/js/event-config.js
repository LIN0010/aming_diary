/* 活動的日期、模擬基數、門檻及文案集中於此；不連線至玩家伺服器。 */
(() => {
    const config = {
        storageKey: "aming-diary-events-demo-v1",
        // 固定展示日讓春日 Prototype 隨時可玩；倒數仍依實際經過時間前進。
        demoClock: true,
        demoDate: "2027-03-21T10:00:00+08:00",
        playerName: "旅人・你",
        maxPhotos: 12,
        maxImageBytes: 180000,
        maxFileBytes: 10 * 1024 * 1024,
        photo: {
            id: "spring-2027", title: "春日花季攝影祭",
            start: "2027-03-15T00:00:00+08:00", end: "2027-04-01T00:00:00+08:00",
            introduction: "把沿途的春天，留在同一本相簿裡。每一張照片，都是我們共同走過的風景。",
            theme: "月台邊，春天的顏色", themeDescription: "選一張花朵、沿線風景或旅途中讓你想停下腳步的照片，寫下這一刻。這裡是合作攝影祭，不必重走車站劇情。",
            baseCount: 7, goal: 10,
            rewards: [
                { id: "pose", at: 8, name: "限定拍照動作", description: "春風裡的招手" },
                { id: "frame", at: 9, name: "限定相框", description: "花箋留影" },
                { id: "collection", at: 10, name: "活動紀念收藏", description: "春日鐵道紀念票" }
            ],
            album: [
                { id: "seed-1", name: "小禾", title: "下一站，花開", art: "blossom" },
                { id: "seed-2", name: "慢慢", title: "沿著春風走", art: "hills" },
                { id: "seed-3", name: "青鳥", title: "把晴天帶回家", art: "sky" }
            ]
        },
        race: {
            id: "rail-2027", title: "鐵道旅行陣營戰",
            start: "2027-03-15T00:00:00+08:00", end: "2027-04-01T00:00:00+08:00",
            introduction: "有人追逐下一個遠方，有人收藏沿途的小事。找到你的旅行節奏，一起為陣營留下足跡。",
            teams: [
                { id: "blue", name: "逐風列車", subtitle: "追著海風，奔向新的地平線", score: 260, members: 18 },
                { id: "sage", name: "拾光月台", subtitle: "慢一點，把日常的風景收進口袋", score: 340, members: 23 }
            ],
            questions: [
                { title: "火車即將進站，你會選擇……", choices: ["跳上下一班，看看未知的遠方", "坐在月台，聽完這一首風的聲音"] },
                { title: "車窗外最讓你心動的風景？", choices: ["開闊海岸與一閃而過的山線", "老街轉角和有人照料的小花園"] },
                { title: "旅程空出一個下午，你想……", choices: ["走一條從沒去過的支線", "在喜歡的小站多留一會兒"] }
            ],
            tasks: [
                { id: "ticket", name: "收集一枚活動票根", instruction: "打開本次活動票券，留下第一枚旅行郵戳。", action: "蓋下郵戳", points: 30 },
                { id: "compass", name: "辨認鐵道方向", instruction: "在活動地圖中，找出面向太平洋的旅行方向。", action: "選擇方向", points: 50 },
                { id: "postcard", name: "寄一張旅行明信片", instruction: "寫下至少 5 個字的旅行祝福，替陣營帶回最後一份貢獻。", action: "寄出明信片", points: 80 }
            ],
            contributionThreshold: 100,
            rewards: { participation: "旅行同伴紀念章", personal: "鐵道手札限定相框", winner: "順風旅人稱號與陣營紀念收藏" },
            ranking: [ { name: "山線旅人", points: 210 }, { name: "海邊的小站", points: 120 }, { name: "背包裡的陽光", points: 60 } ]
        }
    };
    function freeze(value) {
        Object.values(value).forEach(item => { if (item && typeof item === "object") freeze(item); });
        return Object.freeze(value);
    }
    window.EventConfig = freeze(config);
})();
