export type CameraStylePreset = {
  id: string;
  name: string;
  summary: string;
  cameraSystem: string;
  opticalTexture: string;
  imageTexture: string;
  lighting: string;
  atmosphere: string;
  exposureContrast: string;
  spatialDepth: string;
  shootingMethod: string;
  performance: string;
  avoid: string;
};

export type StyleEnhancer = {
  id: string;
  label: string;
  prompt: string;
  conflicts?: string[];
};

export const CAMERA_STYLE_PRESETS: CameraStylePreset[] = [
  {
    id: "natural_practical_light",
    name: "自然实用光写实",
    summary: "以真实空间的窗光、台灯、屏幕光为主，保留生活现场感。",
    cameraSystem: "ARRI Alexa Mini LF 或同级数字电影机质感，肤色自然，动态范围宽，暗部保留细节。",
    opticalTexture: "现代电影定焦的干净解析，不刻意炫耀光学变形，边缘保持稳定。",
    imageTexture: "真实皮肤纹理、织物褶皱、墙面颗粒和日常物件反光，不做过度磨皮。",
    lighting: "窗光、台灯、手机屏幕、室内实用灯作为可见光源，柔和侧光塑造脸部层次。",
    atmosphere: "空气干净或轻微浮尘，生活空间有呼吸感，不制造夸张戏剧雾。",
    exposureContrast: "中低反差，脸部可读，暗部不过死黑，高光不过曝。",
    spatialDepth: "前景生活物件、中景人物、背景环境层次清楚，空间不过度装饰。",
    shootingMethod: "以稳定观察、轻微跟随、缓慢靠近为主，让表演推动镜头。",
    performance: "表演克制，台词前后留停顿，眼神回避、呼吸和手部小动作承担潜台词。",
    avoid: "避免广告感柔光、过亮磨皮、MV式慢动作、无意义大幅运动。",
  },
  {
    id: "low_key_high_contrast",
    name: "低照度高反差",
    summary: "低照度、硬侧光、厚暗部，适合压迫、危险、秘密暴露的场面。",
    cameraSystem: "Sony Venice 2 或同级数字电影机质感，暗部噪点可控，高光边界清晰。",
    opticalTexture: "Cooke 系列暖肤色和柔和边缘过渡，高光允许轻微拉丝与呼吸感。",
    imageTexture: "皮革、金属、湿墙、玻璃水痕和粗糙混凝土有可见材质重量。",
    lighting: "单侧硬光、门缝光、车灯、路灯或屏幕冷光形成强明暗分割。",
    atmosphere: "少量烟雾或尘埃让光束可见，背景暗处保留未知空间。",
    exposureContrast: "高反差，人物半张脸进入暗部，关键眼神和嘴角仍可读。",
    spatialDepth: "利用门框、走廊、车窗、墙角压缩人物，背景不抢主体。",
    shootingMethod: "固定观察、缓慢推进、短距离横移，运动少但有压力。",
    performance: "台词短、停顿长，压低声音，手指收紧、吞咽、视线错开表达隐藏动机。",
    avoid: "避免把画面拍成全黑，避免快速旋转，避免霓虹或装饰光抢走表演。",
  },
  {
    id: "thirtyfive_film_grain",
    name: "35mm 胶片颗粒",
    summary: "35mm 胶片摄影机质感，颗粒、晕光和轻微不完美带来经典电影触感。",
    cameraSystem: "ARRICAM / Panavision 35mm 胶片摄影机质感，保留胶片颗粒和高光晕染。",
    opticalTexture: "Vintage anamorphic 或 Cooke S4 的柔和肤色，亮部可有轻微 halation 和拉丝高光。",
    imageTexture: "胶片颗粒均匀可见，皮肤、布料、旧木、纸张和金属反光自然不过锐。",
    lighting: "实用光与柔和侧逆光结合，高光有胶片扩散感，暗部不过分干净。",
    atmosphere: "空气中有轻微尘埃和温热感，环境像被真实光线浸过。",
    exposureContrast: "中等反差，高光柔，暗部有层次，允许少量曝光不完美。",
    spatialDepth: "前景遮挡和纵深走廊强化空间，不追求数码锐利的全景清晰。",
    shootingMethod: "稳重推近、缓慢横移、停留式观察，让画面有胶片节奏。",
    performance: "表演更重眼神和沉默，台词像压在喉咙里，情绪通过呼吸和身体停顿释放。",
    avoid: "避免过度锐化、塑料肤质、电子屏过亮、现代短视频滤镜感。",
  },
  {
    id: "sixteen_doc_grit",
    name: "16mm 粗粝纪录感",
    summary: "手持、粗颗粒、现场光，适合紧张跟拍、现实质地和不稳定关系。",
    cameraSystem: "16mm 胶片摄影机或模拟 16mm 纪录片质感，颗粒明显，宽容度有限。",
    opticalTexture: "轻微边缘衰减、偶发柔焦和现场感抖动，画面不追求完美整洁。",
    imageTexture: "粗颗粒、汗水、旧布、灰尘、墙皮、手持设备和杂乱空间细节可见。",
    lighting: "现场可用光优先，顶灯、路灯、手电、窗光都可以成为主要光源。",
    atmosphere: "空气更粗糙，有热气、灰尘、烟雾或人群压迫感。",
    exposureContrast: "中高反差，允许局部欠曝或高光压不住，但主体表情必须可读。",
    spatialDepth: "人物常被环境挤压，背景信息多但焦点仍围绕戏剧动作。",
    shootingMethod: "轻微手持跟随、近距离观察、偶发重新找焦，让现场发生感更强。",
    performance: "表演像被现场捕捉，话语可被打断，呼吸、犹豫、身体后退比完整台词更重要。",
    avoid: "避免精致广告布光、完美构图、过度稳定、过强美颜。",
  },
  {
    id: "haze_volume_light",
    name: "雾霾体积光",
    summary: "雾霾、烟尘、可见光束和层层空间，适合神秘、回忆、压抑的气氛。",
    cameraSystem: "ARRI Alexa 35 或同级数字电影机质感，保留雾中高光层次和暗部细节。",
    opticalTexture: "柔和扩散的光学质感，高光边缘有轻微泛散，不追求硬锐轮廓。",
    imageTexture: "空气介质成为主要材质，雾、尘、烟、湿墙、织物边缘都要有可见层次。",
    lighting: "强侧逆光或窗外斜射光穿过雾霾，形成明确体积光束。",
    atmosphere: "空间有厚空气感，人物像被雾和光包围，远处逐渐吞没。",
    exposureContrast: "中高反差，明部光束突出，暗部柔和沉下去。",
    spatialDepth: "前景雾层、中景人物、背景轮廓层层递进，远景不完全清晰。",
    shootingMethod: "缓慢推进或静态等待，利用雾的流动和人物微动完成画面变化。",
    performance: "人物说话慢，像怕惊动空气中的秘密，沉默和回头前的迟疑要被保留。",
    avoid: "避免雾过厚遮脸，避免奇幻粒子乱飞，避免高饱和舞台烟雾感。",
  },
  {
    id: "neon_wet_reflection",
    name: "霓虹湿地反光",
    summary: "夜雨、湿地反光、屏幕光和城市压迫，适合未来都市或当代夜景。",
    cameraSystem: "Sony Venice 2 或 RED V-Raptor 数字电影机质感，低照度下保持反光细节。",
    opticalTexture: "轻微 anamorphic 横向拉丝高光，霓虹边缘不过度爆开。",
    imageTexture: "湿地、玻璃、金属、塑料雨衣、车窗水滴和烟雾有真实反射。",
    lighting: "霓虹侧光、车灯、广告屏、便利店冷光作为可见光源。",
    atmosphere: "雨丝、薄雾和路面反光持续微动，城市背景有距离感。",
    exposureContrast: "高反差，背景亮点丰富但主体脸部不被彩光污染。",
    spatialDepth: "前景雨滴或玻璃遮挡，中景人物，背景灯牌和车流形成纵深。",
    shootingMethod: "稳定跟随、短距离横移、慢速靠近，运动服务人物处境。",
    performance: "人物外表冷静，眼神像在扫描信息，台词少但语气有防备。",
    avoid: "避免单纯堆霓虹，避免满屏彩色光斑，避免人物脸变成不可辨认的彩色块。",
  },
  {
    id: "tungsten_warm_practical",
    name: "钨丝灯暖暗部",
    summary: "钨丝灯、烛火、旧室内和暖暗部，适合复古、家庭、民俗或密谈。",
    cameraSystem: "ARRI Alexa Mini 或 35mm 胶片质感，暖光肤色自然，暗部厚实。",
    opticalTexture: "Cooke 暖调肤色与柔和高光，灯泡、烛火边缘有轻微晕光。",
    imageTexture: "木纹、纸张、旧布、瓷器、蜡泪、墙面旧痕和烟尘可见。",
    lighting: "钨丝灯、烛火、油灯、台灯作为实用光源，侧后方暖光勾出人物轮廓。",
    atmosphere: "室内空气有热度和旧物气味，微尘在灯下漂浮。",
    exposureContrast: "中高反差，暖亮部集中，暗部保留沉稳层次。",
    spatialDepth: "桌面道具、人物、门帘或墙面形成三层空间。",
    shootingMethod: "固定观察、慢推、门框或家具遮挡，强调被窥见的亲密感。",
    performance: "人物说话压低，停顿像在试探底线，眼神绕开关键物件。",
    avoid: "避免过度怀旧滤镜、廉价影楼感、亮到没有暗部、现代冷光抢戏。",
  },
  {
    id: "cold_clean_digital",
    name: "冷白数字电影机",
    summary: "冷白实用光、干净结构和理性秩序，适合办公室、实验室、审讯或科技空间。",
    cameraSystem: "ARRI Alexa 35 / Sony Venice 2 数字电影机质感，清晰稳定，动态范围干净。",
    opticalTexture: "现代电影镜组的清洁解析，边缘稳定，高光控制克制。",
    imageTexture: "玻璃、金属、屏幕、白墙、皮肤细节和制服织物清晰可读。",
    lighting: "顶灯、灯带、屏幕冷光和窄侧光构成主要光线，避免装饰化彩光。",
    atmosphere: "空气清冷、干净、略带距离感，环境噪声低。",
    exposureContrast: "中等反差，白色空间不过曝，暗部不过脏。",
    spatialDepth: "线条、玻璃隔断、走廊和桌面设备形成秩序纵深。",
    shootingMethod: "对称或稳定观察，缓慢推轨，人物动作被空间规则限制。",
    performance: "语气冷静、克制、精确，潜台词通过眼神停顿和说话前的沉默暴露。",
    avoid: "避免科幻粒子、炫彩界面、过度锐化、把空间拍成广告片。",
  },
  {
    id: "soft_portrait_shadow",
    name: "柔光浅阴影人像",
    summary: "柔光、浅阴影、皮肤质感和微表情优先，适合亲密对话和情感试探。",
    cameraSystem: "Alexa Mini LF 或同级数字电影机质感，肤色柔和但不失纹理。",
    opticalTexture: "柔和人像光学质感，背景轻微散开，脸部轮廓不过硬。",
    imageTexture: "皮肤、睫毛、唇部干湿、衣领织物、手指细节都要可读。",
    lighting: "大面积窗光、反射柔光或柔和侧光，阴影轻但保留脸部体积。",
    atmosphere: "空气安静，环境细节退后，为眼神和呼吸让位。",
    exposureContrast: "低到中等反差，脸部明暗过渡平滑，高光不过曝。",
    spatialDepth: "前景可有轻微遮挡，背景弱化但不消失，人物关系距离清楚。",
    shootingMethod: "稳定近距离观察，缓慢靠近或几乎不动，让观众看见微变化。",
    performance: "语气轻，情绪藏在停顿、嘴角压住、眼神移开和吸气里。",
    avoid: "避免磨皮过重、偶像剧过曝、背景完全虚无、表情过度夸张。",
  },
  {
    id: "heavy_shadow_pressure",
    name: "暗部厚重压迫",
    summary: "厚暗部、低角度压力和空间包围感，适合审判、威胁、困境和绝望。",
    cameraSystem: "ARRI Alexa 65 / 35mm 胶片质感，暗部有重量，高光只落在关键位置。",
    opticalTexture: "沉稳厚重的光学质感，边缘略柔，不追求数码锐利。",
    imageTexture: "深色织物、旧墙、木门、皮肤汗水、金属暗反光和空气尘埃有重量。",
    lighting: "低位侧光、顶上窄光、背后轮廓光或远处单点光，让人物被暗部吞住。",
    atmosphere: "空气沉闷、低流动，环境像向人物压过来。",
    exposureContrast: "高反差但不过黑，脸部关键信息只在眼睛、鼻梁、嘴角处被光抓住。",
    spatialDepth: "高墙、门框、桌面、走廊尽头形成压迫式纵深。",
    shootingMethod: "低速推进、固定等待、压低机位或近距离遮挡，制造不可逃离感。",
    performance: "人物动作减少到最低，沉默比台词更重，呼吸、握拳、肩膀下沉表达崩塌边缘。",
    avoid: "避免全画面死黑，避免血腥堆砌，避免快速剪辑感，避免解释性台词过满。",
  },
];

export const STYLE_ENHANCERS: StyleEnhancer[] = [
  { id: "cooke_warm_skin", label: "Cooke 暖肤色", prompt: "加入 Cooke 光学质感：肤色更温润，高光边缘柔和，人物脸部不过锐。" },
  { id: "anamorphic_streak", label: "横向拉丝高光", prompt: "亮点允许轻微横向拉丝高光，但主体脸部不能被光斑遮挡。", conflicts: ["clean_edges"] },
  { id: "halation", label: "胶片晕光", prompt: "高光边缘带轻微胶片 halation，形成真实的亮部泛散。" },
  { id: "coarse_grain", label: "粗颗粒", prompt: "加入可见粗颗粒和轻微不完美感，保留现场质地。", conflicts: ["clean_edges"] },
  { id: "volumetric_haze", label: "体积雾", prompt: "空气中有雾霾或烟尘，让侧逆光形成可见体积光束。" },
  { id: "low_light", label: "低照度", prompt: "降低环境照度，只保留关键光源照亮人物眼神、手部或道具。" },
  { id: "high_contrast", label: "高反差", prompt: "增强明暗分割，暗部厚，亮部集中，关键表演仍必须可读。" },
  { id: "wet_reflection", label: "湿地反光", prompt: "地面、玻璃或金属表面出现湿润反光，环境光有真实折射。" },
  { id: "practical_light", label: "实用光源", prompt: "所有主光都来自画面内可解释的灯、窗、屏幕、车灯或烛火。" },
  { id: "static_observation", label: "固定观察", prompt: "摄影机以固定观察或极慢移动为主，让人物表演成为画面重心。", conflicts: ["handheld"] },
  { id: "handheld", label: "轻微手持", prompt: "加入轻微手持现场感，运动克制，不能破坏主体稳定。", conflicts: ["static_observation"] },
  { id: "slow_push", label: "缓慢靠近", prompt: "在关键情绪点使用缓慢靠近，推进必须服务人物心理变化。" },
  { id: "performance_silence", label: "表演留白", prompt: "在台词前后保留沉默、呼吸、眼神落点和身体停顿。" },
  { id: "subtext_first", label: "潜台词优先", prompt: "角色真实意图不直接说破，通过回避视线、嘴角控制、手部动作表达。" },
  { id: "micro_expression", label: "微表情", prompt: "强调眼神、眉峰、嘴角、吞咽、吸气和肩颈微动的细节。" },
  { id: "clean_edges", label: "干净边缘", prompt: "画面边缘清洁稳定，减少光学变形、颗粒和眩光，主体轮廓清晰。", conflicts: ["anamorphic_streak", "coarse_grain"] },
];

export function getCameraStylePreset(id?: string | null): CameraStylePreset {
  return CAMERA_STYLE_PRESETS.find((preset) => preset.id === id) ?? CAMERA_STYLE_PRESETS[0];
}

export function getStyleEnhancers(ids?: string[] | string | null): StyleEnhancer[] {
  const list = Array.isArray(ids)
    ? ids
    : typeof ids === "string"
      ? ids.split(",").map((id) => id.trim()).filter(Boolean)
      : [];
  const allowed = new Set(list.slice(0, 5));
  return STYLE_ENHANCERS.filter((tag) => allowed.has(tag.id));
}

export function validateStyleEnhancers(ids: string[]): { selectedIds: string[]; warnings: string[] } {
  const selectedIds = ids.filter((id, index) => ids.indexOf(id) === index).slice(0, 5);
  const selected = getStyleEnhancers(selectedIds);
  const selectedSet = new Set(selected.map((item) => item.id));
  const warnings: string[] = [];
  for (const item of selected) {
    for (const conflict of item.conflicts ?? []) {
      if (selectedSet.has(conflict)) {
        const other = STYLE_ENHANCERS.find((tag) => tag.id === conflict);
        warnings.push(`${item.label} 与 ${other?.label ?? conflict} 有冲突，建议只保留一个。`);
      }
    }
  }
  return { selectedIds, warnings: Array.from(new Set(warnings)) };
}

export function buildVisualStylePrompt(preset: CameraStylePreset, enhancerIds: string[] = []): string {
  const enhancers = getStyleEnhancers(enhancerIds);
  const lines = [
    `摄影风格：${preset.name}。${preset.summary}`,
    `摄影机质感：${preset.cameraSystem}`,
    `光学质感：${preset.opticalTexture}`,
    `影像材质：${preset.imageTexture}`,
    `光影方式：${preset.lighting}`,
    `空气介质：${preset.atmosphere}`,
    `曝光与反差：${preset.exposureContrast}`,
    `空间层次：${preset.spatialDepth}`,
    `拍摄手法：${preset.shootingMethod}`,
    `表演规则：${preset.performance}`,
  ];
  if (enhancers.length) {
    lines.push(`增强标签：${enhancers.map((item) => `${item.label}，${item.prompt}`).join("；")}`);
  }
  lines.push(`禁忌：${preset.avoid}`);
  return lines.join("\n");
}

export const VISUAL_STYLE_PRESETS = CAMERA_STYLE_PRESETS;
export const getVisualStylePreset = getCameraStylePreset;
export type VisualStylePreset = CameraStylePreset;
