import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'demo-key',
});
const CANDIDATE_MODELS = [
  import.meta.env.VITE_GEMINI_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
].filter((model, index, models) => Boolean(model) && models.indexOf(model) === index);

const VISION_MODELS = [
  import.meta.env.VITE_GEMINI_VISION_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
].filter((model, index, models) => Boolean(model) && models.indexOf(model) === index);

// Schema for structured item recognition
const itemSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: '물건 이름 (한국어)' },
          category: {
            type: Type.STRING,
            description: '카테고리',
            enum: ['책', '의류', '전자기기', '식기', '문구', '화장품', '장식품', '식품', '잡화', '기타'],
          },
          size: {
            type: Type.STRING,
            description: '대략적인 크기',
            enum: ['tiny', 'small', 'medium', 'large'],
          },
          description: { type: Type.STRING, description: '물건에 대한 간단한 설명' },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: '사진 속 해당 물건의 2D 위치 [ymin, xmin, ymax, xmax] (0부터 1000 사이 정수 좌표). 물건이 온전히 포함되도록 정확한 영역 지정.',
          },
        },
        required: ['name', 'category', 'size', 'description', 'box_2d'],
      },
    },
  },
  required: ['items'],
};

/**
 * Analyze a photo and extract items from it using Gemini Vision.
 * @param {string} base64Image - Base64-encoded image data (without data: prefix)
 * @param {string} mimeType - MIME type of the image (e.g., 'image/jpeg')
 * @returns {Promise<Array>} - Array of recognized items
 */
export async function analyzeImage(base64Image, mimeType = 'image/jpeg') {
  if (!import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY === 'demo-key') {
    throw new Error('API_KEY_MISSING');
  }
  const prompt = `당신은 사진 속 물건을 식별하고 위치를 감지하는 정리 전문가입니다.

이 사진을 주의 깊게 살펴보고, 보이는 물건을 하나하나 빠짐없이 모두 찾아주세요.

규칙:
- 물건이 겹쳐 있거나 일부만 보여도 식별 가능하면 포함하세요.
- 각 물건마다 이름, 카테고리, 크기, 간단한 설명을 작성하세요.
- 이름은 구체적으로 적어주세요 (예: "스누피 인형", "스타벅스 텀블러", "니베아 데오드란트 스프레이", "케라시스 샴푸").
- 사진이 흐리거나 확신할 수 없을 때도 보이는 형태를 기준으로 일반적인 이름을 추정해 포함하세요.
- [중요: 타이트한 초근접 클로즈업 좌표] 각 물건마다 배경이나 주변 여백을 최소화하고 물건 본체 테두리에 바짝 밀착한 타이트한 2D 바운딩 박스 [ymin, xmin, ymax, xmax] (0~1000 정수 좌표)를 box_2d에 반드시 반환하세요. 이 좌표는 아이콘 자리의 초근접 클로즈업 썸네일 크롭에 사용되므로 주변 여백 없이 물건 자체만 가득 차게 타이트하게 지정해주세요.
- 한국어로 답변해주세요.`;

  let lastError;
  for (const model of VISION_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: itemSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.items)) return parsed.items;
      throw new Error('EMPTY_RECOGNITION_RESULT');
    } catch (error) {
      lastError = error;
      console.warn(`${model} 물건 인식 실패, 다음 모델을 시도합니다.`, error);
    }
  }
  throw lastError || new Error('RECOGNITION_FAILED');
}

// Schema for ultra-concise chat with interactive quickReplies & inventory actions
const chatSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: '1-2문장 이내의 아주 간결하고 명확한 한국어 답변. 긴 설명 절대 금지.',
    },
    quickReplies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '사용자가 터치해서 바로 보낼 수 있는 짧은 답변 옵션들 (3-4개)',
    },
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ['rename', 'updateUsage', 'move', 'discard'],
            description: 'rename(이름변경), updateUsage(사용도), move(위치이동), discard(폐기/비우기)',
          },
          targetId: {
            type: Type.STRING,
            description: '수정할 물건의 고유 ID (id 필드)',
          },
          targetName: {
            type: Type.STRING,
            description: '수정할 기존 물건 이름 (목록의 물건 이름과 매칭)',
          },
          newName: {
            type: Type.STRING,
            description: '새 이름 (rename 시 필수)',
          },
          usage: {
            type: Type.STRING,
            enum: ['frequent', 'unused_3m', 'unused_1y'],
            description: '사용도: frequent(자주/최근), unused_3m(3개월 미사용), unused_1y(1년+ 미사용)',
          },
          location: {
            type: Type.STRING,
            description: '새 위치 (move 시 필수)',
          },
        },
        required: ['type', 'targetName'],
      },
      description: '대화에서 파악된 물건 정보 변경 목록',
    },
  },
  required: ['reply', 'quickReplies', 'actions'],
};

/**
 * Smart local fallback response when Gemini models encounter rate limits or network issues.
 */
function generateLocalConsultantResponse(items, userMessage) {
  const count = items.length;
  const unclassified = items.filter((i) => !i.location || i.location === '미분류');
  const msgLower = (userMessage || '').toLowerCase();
  const actions = [];

  // 사용자 입력에서 이름 변경 / 사용도 / 폐기 감지
  for (const item of items) {
    if (userMessage && userMessage.includes(item.name)) {
      if (msgLower.includes('자주') || msgLower.includes('매일') || msgLower.includes('사용하고 있어') || msgLower.includes('쓰고 있어')) {
        actions.push({ type: 'updateUsage', targetName: item.name, usage: 'frequent' });
      } else if (msgLower.includes('3개월') || msgLower.includes('가끔')) {
        actions.push({ type: 'updateUsage', targetName: item.name, usage: 'unused_3m' });
      } else if (msgLower.includes('안 써') || msgLower.includes('안 쓰고') || msgLower.includes('1년') || msgLower.includes('버릴')) {
        actions.push({ type: 'updateUsage', targetName: item.name, usage: 'unused_1y' });
      }
    }
  }

  // "A는 B야" 패턴으로 이름 변경 감지
  const renameMatch = userMessage && userMessage.match(/(?:(.+?)\s*(?:은|는)\s*(.+?)(?:이야|야|로 바꿔줘|로 변경))/);
  if (renameMatch) {
    const rawTarget = renameMatch[1].trim();
    const rawNewName = renameMatch[2].trim();
    const matchedItem = items.find((i) => rawTarget.includes(i.name) || i.name.includes(rawTarget));
    if (matchedItem && rawNewName) {
      actions.push({ type: 'rename', targetId: matchedItem.id, targetName: matchedItem.name, newName: rawNewName });
    }
  }

  // "사진 없는 물건 비우기" 감지
  const isPhotoNoneDeclutter =
    (msgLower.includes('사진') && (msgLower.includes('없는') || msgLower.includes('안') || msgLower.includes('등록 안') || msgLower.includes('등록안') || msgLower.includes('미등록'))) &&
    (msgLower.includes('비움') || msgLower.includes('비워') || msgLower.includes('버려') || msgLower.includes('폐기') || msgLower.includes('정리'));

  if (isPhotoNoneDeclutter) {
    const noPhotoItems = items.filter((i) => (!i.imageUrl || i.imageUrl.length === 0) && i.status !== 'discarded');
    if (noPhotoItems.length > 0) {
      noPhotoItems.forEach((item) => {
        actions.push({ type: 'discard', targetId: item.id, targetName: item.name });
      });
      return {
        reply: `사진이 등록되지 않은 물건 ${noPhotoItems.length}개를 비움(폐기) 처리했어요! ✨`,
        quickReplies: ['내 물건 보기 📋', '다른 물건 정리 🧹', '정리 완료 ✨'],
        actions,
      };
    } else {
      return {
        reply: `사진이 없는 물건이 없거나 이미 모두 비움 처리되었습니다. 😊`,
        quickReplies: ['자주 쓰는 물건 정리 ⭐', '미분류 물건 배치 📍', '정리 완료 ✨'],
        actions: [],
      };
    }
  }

  if (!userMessage || msgLower.includes('정리 도와줘') || msgLower.includes('안녕') || msgLower.includes('시작') || msgLower.includes('선택') || msgLower.includes('정리할래')) {
    const target = unclassified[0] || items[0];
    return {
      reply: target
        ? `선택하신 물건 정리를 시작할게요! '${target.name}'부터 볼까요? 얼마나 자주 쓰시나요? 😊`
        : `안녕하세요! 등록된 물건 ${count}개의 정리를 도와드릴게요.`,
      quickReplies: ['자주 써요 ⭐', '3개월 안 썼어요 ⏳', '1년 넘게 안 썼어요 📦', '이름 바꿀래요 ✏️'],
      actions,
    };
  }

  if (actions.length > 0) {
    return {
      reply: `말씀해주신 내용을 물건 목록에 바로 반영했어요! 👍`,
      quickReplies: ['다음 물건 보기 ➡️', '책상 위 정리', '서랍 정리', '정리 완료 ✨'],
      actions,
    };
  }

  const randomItem = unclassified[0] || items[Math.floor(Math.random() * items.length)];
  return {
    reply: randomItem
      ? `'${randomItem.name}'의 위치를 어디로 옮기거나 보관할까요?`
      : `정리하고 싶은 물건이나 위치를 편하게 말씀해주세요!`,
    quickReplies: ['자주 써요 ⭐', '3개월 안 썼어요 ⏳', '버릴래요 🗑️', '다음 물건 ➡️'],
    actions: [],
  };
}

/**
 * Chat with the organization agent.
 * Returns structured object: { reply: string, quickReplies: string[], actions: Array<{...}> }
 * @param {Array} items - Current items in the user's inventory
 * @param {Array} chatHistory - Previous chat messages [{role, text}]
 * @param {string} userMessage - The user's new message
 * @returns {Promise<{reply: string, quickReplies: string[], actions: Array}>} - Agent's structured response
 */
export async function chatWithAgent(items, chatHistory, userMessage) {
  const simplifiedItems = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    location: i.location || '미분류',
    usage: i.usage || 'frequent',
    status: i.status || 'active',
    hasPhoto: Boolean(i.imageUrl && i.imageUrl.length > 0),
  }));

  const systemPrompt = `당신은 방 정리 앱 "CLOOMY"의 초간결 AI 정리 비서입니다.

핵심 규칙:
1. [답변(reply) 초간결 원칙]:
   - 반드시 1~2문장으로 아주 짧고 깔끔하게 작성하세요.
   - 긴 인사말, 번호 매긴 긴 목록, 문단 설명은 절대 금지합니다.
2. [터치 옵션(quickReplies) 제공]:
   - 사용자가 타이핑하지 않고 버튼만 눌러서 바로 응답할 수 있도록 상황에 맞는 3~4개의 짧은 선택지를 반드시 만드세요.
   - 예시: ["자주 써요 ⭐", "3개월 안 썼어요 ⏳", "1년 넘게 안 씀 (버리기 🗑️)", "책상으로 이동 📍", "다음 물건 보기 ➡️"]
3. [물건 목록 실시간 반영(actions)]:
   - 각 액션 객체에는 targetId(물건의 고유 id)와 targetName(물건 이름)을 반드시 둘 다 지정하세요.
   - 사용자가 물건의 진짜 이름이나 별칭을 알려주면 type: "rename", targetId: "<id>", targetName: "<기존이름>", newName: "<새이름>" 액션을 생성하세요.
   - 사용 빈도를 말하면 type: "updateUsage", usage: "frequent" | "unused_3m" | "unused_1y" 액션을 생성하세요.
   - 위치를 옮기자고 하면 type: "move", location: "<새위치>" 액션을 생성하세요.
   - 버리거나 안 쓴다고 하면 type: "discard" 액션을 생성하세요.
4. [사진 등록 여부(hasPhoto) 및 비우기/정리 규칙 - 엄격 준수!]:
   - hasPhoto 속성은 true(사진 등록됨), false(사진 미등록, 기본 아이콘 상태)입니다.
   - 사용자가 "사진 없는 물건", "사진 안 등록된 물건", "사진 미등록 물건"을 비우거나(discard) 정리해달라고 하면, **반드시 hasPhoto === false 인 물건들만** 골라서 actions(type: 'discard')를 생성하세요.
   - **사진이 등록된 물건(hasPhoto === true)은 절대로 비움(discard)이나 변경 대상에 포함시키지 마세요!**
   - 만약 조건에 해당하는 물건이 여러 개라면, 해당 조건(hasPhoto === false)의 물건들을 모두 actions 배열에 담으세요.

사용자의 현재 물건 목록:
${JSON.stringify(simplifiedItems, null, 2)}`;

  const contents = [
    ...chatHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text) }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ];

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseJsonSchema: chatSchema,
        },
      });

      const raw = response.text || '{}';
      const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.reply) {
        return {
          reply: parsed.reply.trim(),
          quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies : [],
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        };
      }
    } catch (error) {
      console.warn(`[chatWithAgent] ${model} 실패, 다음 모델 시도:`, error);
    }
  }

  return generateLocalConsultantResponse(items, userMessage);
}

/**
 * Get initial organization recommendations for items.
 * @param {Array} items - Items to analyze
 * @returns {Promise<string>} - Recommendations text
 */
export async function getRecommendations(items) {
  const simplifiedItems = items.map((i) => ({
    name: i.name,
    category: i.category,
    location: i.location || '미분류',
  }));

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `다음 물건 목록을 분석해서 정리 추천을 해주세요. 보관/폐기/재배치를 제안해주세요.

물건 목록:
${JSON.stringify(simplifiedItems, null, 2)}

각 물건에 대해 간단한 추천을 해주세요. 이모지를 활용해주세요.`,
        },
      ],
    },
  ];

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
      });

      if (response.text?.trim()) {
        return response.text.trim();
      }
    } catch (error) {
      console.warn(`[getRecommendations] ${model} 실패, 다음 모델 재시도:`, error);
    }
  }

  return `등록된 물건 ${items.length}개를 분석했어요! 🧹\n\n1. 최근 3개월 동안 한 번도 쓰지 않은 물건부터 폐기 또는 나눔을 고려해보세요.\n2. 자주 쓰는 물건은 책상이나 손이 닿기 쉬운 서랍 1번째 칸에 배치하는 것을 추천해요.\n3. 아직 위치가 정해지지 않은 미분류 물건들을 방 안의 가구에 나누어 담아보세요! ✨`;
}

/**
 * Recalibrate relative sizes of items in the same scene when the user corrects one reference item's size.
 * @param {Object} referenceItem - The item whose size was manually specified by user
 * @param {string} newSize - The newly chosen size ('tiny' | 'small' | 'medium' | 'large')
 * @param {Array} allItems - All items present in the same photo/scene
 * @returns {Promise<Array>} - Updated items array with adjusted sizes and brief explanation
 */
const recalibrationSchema = {
  type: Type.OBJECT,
  properties: {
    updatedItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          refIndex: { type: Type.INTEGER, description: '물건 번호 (1부터 시작)' },
          name: { type: Type.STRING, description: '물건 이름' },
          size: {
            type: Type.STRING,
            enum: ['tiny', 'small', 'medium', 'large'],
          },
          explanation: { type: Type.STRING },
        },
        required: ['refIndex', 'name', 'size'],
      },
    },
  },
  required: ['updatedItems'],
};

export async function recalibrateItemSizes(referenceItem, newSize, allItems) {
  const sizeOrder = ['tiny', 'small', 'medium', 'large'];
  const oldIndex = sizeOrder.indexOf(referenceItem.size || 'small');
  const newIndex = sizeOrder.indexOf(newSize);
  const delta = newIndex !== -1 && oldIndex !== -1 ? newIndex - oldIndex : 0;

  // 1. 모든 아이템에 대해 수학적 비례 보정 베이스라인을 먼저 완벽히 구성
  const baselineMap = new Map();
  allItems.forEach((item) => {
    const isRef = item.id ? item.id === referenceItem.id : item.name === referenceItem.name;
    if (isRef) {
      baselineMap.set(item.name, {
        id: item.id,
        name: item.name,
        size: newSize,
        explanation: '기준 물건 직접 지정',
      });
    } else {
      const curIdx = sizeOrder.indexOf(item.size || 'small');
      const adjustedIdx = Math.max(0, Math.min(3, curIdx + delta));
      baselineMap.set(item.name, {
        id: item.id,
        name: item.name,
        size: sizeOrder[adjustedIdx],
        explanation: `'${referenceItem.name}' 기준 비례 스케일 자동 보정`,
      });
    }
  });

  const sizeLabels = {
    tiny: '아주 작음 (손가락 크기)',
    small: '작음 (손바닥 크기)',
    medium: '보통 (팔뚝 크기)',
    large: '큼 (그 이상 크기)',
  };

  const prompt = `당신은 사진 속 사물들의 상대적 크기 비례를 분석하는 AI 전문가입니다.
동일한 사진 속에 함께 찍힌 물건들 중 하나인 "${referenceItem.name}"의 실제 크기가 "${sizeLabels[newSize] || newSize}"(으)로 확인되었습니다.
(이전 추정 크기: ${sizeLabels[referenceItem.size] || referenceItem.size} -> 실제 크기: ${sizeLabels[newSize] || newSize})

규칙:
1. 목록에 있는 모든 물건(${allItems.length}개) 각각에 대해 비례에 맞게 조정된 크기를 빠짐없이 모두 updatedItems 배열에 포함하세요.
2. 각 물건마다 refIndex(1부터 시작), name(물건 이름), size(tiny/small/medium/large), explanation을 반드시 반환하세요.
3. 기준 물건이 이전보다 커졌으면 다른 물건들도 전반적으로 상향 조정하고, 작아졌으면 하향 조정하세요.

물건 목록:
${allItems
  .map(
    (item, idx) =>
      `[${idx + 1}] 이름: ${item.name}, 카테고리: ${item.category}, 현재크기: ${item.size}${
        (item.id ? item.id === referenceItem.id : item.name === referenceItem.name)
          ? ' (👈 기준 물건)'
          : ''
      }`
  )
  .join('\n')}`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: recalibrationSchema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const raw = response.text || '{}';
      const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.updatedItems && parsed.updatedItems.length > 0) {
        parsed.updatedItems.forEach((u) => {
          const orig = allItems[u.refIndex - 1] || allItems.find((a) => a.name === u.name);
          const key = orig?.name || u.name;
          if (key && u.size) {
            baselineMap.set(key, {
              id: orig?.id,
              name: key,
              size: u.size,
              explanation: u.explanation || 'AI 상대적 비례 분석 보정',
            });
          }
        });
        return Array.from(baselineMap.values());
      }
    } catch (err) {
      console.warn(`[recalibrateItemSizes] ${model} 실패, 다음 모델 재시도:`, err);
    }
  }

  return Array.from(baselineMap.values());
}
