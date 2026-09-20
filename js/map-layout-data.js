// 馆长办公室标注，来源：用户 2026-09-20 导出。其余地图保留原始配置。
window.MuseumMapLayoutData = {
  "version": 1,
  "savedAt": "2026-09-20T13:26:17.673Z",
  "rooms": {
    "office": {
      "id": "office",
      "title": "馆长办公室",
      "chapter": "第一幕",
      "width": 1670,
      "height": 942,
      "spawn": {
        "x": 830,
        "y": 780
      },
      "walkable": [],
      "colliders": [
        {
          "x": 0,
          "y": 0,
          "w": 1670,
          "h": 315
        },
        {
          "x": 0,
          "y": 0,
          "w": 180,
          "h": 942
        },
        {
          "x": 1455,
          "y": 0,
          "w": 215,
          "h": 942
        },
        {
          "x": 550,
          "y": 300,
          "w": 520,
          "h": 180
        },
        {
          "x": 609,
          "y": 490,
          "w": 420,
          "h": 157
        },
        {
          "x": 0,
          "y": 885,
          "w": 730,
          "h": 57
        },
        {
          "x": 935,
          "y": 885,
          "w": 735,
          "h": 57
        }
      ],
      "objects": [
        {
          "id": "office-director",
          "type": "scene",
          "label": "馆长",
          "x": 1130,
          "y": 390,
          "r": 100,
          "scene": "scene-08",
          "requiredFlag": "scene07Seen"
        },
        {
          "id": "office-corner",
          "type": "scene",
          "label": "办公室门口",
          "x": 540,
          "y": 830,
          "r": 100,
          "scene": "scene-09",
          "requiredFlag": "scene08Seen"
        },
        {
          "id": "office-exit",
          "type": "travel",
          "label": "返回馆内总览",
          "x": 835,
          "y": 865,
          "r": 90,
          "target": "museum"
        },
        {
          "id": "wax-scene-17",
          "type": "scene",
          "scene": "scene-15",
          "requiredFlag": "scene14Seen",
          "x": 1130,
          "y": 390,
          "r": 72,
          "label": "馆长办公室"
        },
        {
          "id": "wax-scene-24",
          "type": "scene",
          "scene": "scene-22",
          "requiredFlag": "scene21Seen",
          "x": 1130,
          "y": 390,
          "r": 72,
          "label": "第二份契约"
        }
      ]
    }
  }
};
