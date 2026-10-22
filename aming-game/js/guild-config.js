/* 本機旅團示範設定；正式素材與熱區只需在這裡調整。 */
(() => {
    const config = {
        storageKey: 'aming-diary-guild-v1', maxMembers: 6, minMembers: 2,
        player: { id: 'you', name: '旅人・你', avatar: 'images/aming.png' },
        room: { image: 'images/guild-room-bg.png', width: 1536, height: 1024,
            hotspots: [
                { id: 'puzzle', label: '共同回憶拼圖', x: .429, y: .217, w: .341, h: .303 },
                { id: 'wall', label: '翻開旅行手帳', x: .341, y: .705, w: .224, h: .09 }
            ], progress: { x: .60, y: .535 } },
        invite: 'RAIL2027', demoName: '沿線慢慢走', initialDraws: 3, initialPoints: 160,
        duplicatePoints: 4, exchangeCost: 10,
        members: [
            { id: 'demo-mori', name: '小森', avatar: 'images/cow.png', shares: 3, contribution: 8 },
            { id: 'demo-light', name: '拾光', avatar: 'images/aming.png', shares: 2, contribution: 6 },
            { id: 'demo-wind', name: '風旅人', avatar: 'images/cow.png', shares: 2, contribution: 3 },
            { id: 'demo-rain', name: '雨禾', avatar: 'images/aming.png', shares: 0, contribution: 0 },
            { id: 'demo-sea', name: '海生', avatar: 'images/cow.png', shares: 0, contribution: 0 }
        ],
        demoPosts: [
            { memberId: 'demo-mori', station: '花蓮', summary: '把山線的風收進手帳，下一次想和大家一起出發。' },
            { memberId: 'demo-light', station: '福隆', summary: '等一班慢車，也等海邊的光落在月台上。' },
            { memberId: 'demo-wind', station: '台南', summary: '在老街轉角寄出明信片，替這段旅程留下一枚郵戳。' }
        ],
        stations: [{ id: 'ruisui', name: '瑞穗', memory: 'ruisui-01', summary: '在瑞穗，循著乳牛與月台的回憶，找回阿明留下的一頁日記。' }],
        puzzles: [
            { id: 'spring', title: '沿線的春日', rows: 3, cols: 4, image: 'images/ruisui-memory-01.png', aspect: 1284/1225, placeholder: true,
                initial: [0,1,2,3,4,5,6], story: '【示範補充故事】阿明把車票夾進手帳。原來，有人陪著一起收藏的風景，會在記憶裡停留得更久。' },
            { id: 'limited', title: '小站的約定', rows: 4, cols: 5, image: 'images/home-bg.jpg', aspect: 1670/941, placeholder: true,
                initial: [0,1,2,3,4,5,6,7,8,9], story: '【示範補充故事】列車經過窗邊時，阿明在日記最後畫了一個小小的站牌：下次，還要一起旅行。' }
        ]
    };
    function freeze(o) { Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); }
    window.GuildConfig = freeze(config);
})();
