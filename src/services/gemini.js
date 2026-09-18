import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'demo-key',
});

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
        },
        required: ['name', 'category', 'size', 'description'],
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
  const prompt = `당신은 사진 속 물건을 식별하는 전문가입니다.

이 사진을 주의 깊게 살펴보고, 보이는 물건을 하나하나 빠짐없이 모두 찾아주세요.

규칙:
- 물건이 겹쳐 있거나 일부만 보여도 식별 가능하면 포함하세요.
- 각 물건마다 이름, 카테고리, 크기, 간단한 설명을 작성하세요.
- 이름은 구체적으로 적어주세요 (예: "니베아 데오드란트 스프레이", "케라시스 샴푸").
- 한국어로 답변해주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
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
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    const parsed = JSON.parse(response.text);
    return parsed.items || [];
  } catch (err) {
    console.warn('Structured output failed, trying fallback:', err);
    // Fallback: JSON 모드 without schema
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
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
            {
              text: `${prompt}

반드시 아래 JSON 형식으로만 답변하세요:
{"items": [{"name": "물건이름", "category": "카테고리", "size": "tiny|small|medium|large", "description": "설명"}]}

category는 다음 중 하나: 책, 의류, 전자기기, 식기, 문구, 화장품, 장식품, 식품, 잡화, 기타
size는 다음 중 하나: tiny(손가락 크기), small(손바닥 크기), medium(팔뚝 크기), large(그 이상)`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    const parsed = JSON.parse(response.text);
    return parsed.items || [];
  }
}

/**
 * Chat with the organization agent.
 * @param {Array} items - Current items in the user's inventory
 * @param {Array} chatHistory - Previous chat messages [{role, text}]
 * @param {string} userMessage - The user's new message
 * @returns {Promise<string>} - Agent's response
 */
export async function chatWithAgent(items, chatHistory, userMessage) {
  const systemPrompt = `당신은 "정리짱"이라는 앱의 AI 정리 컨설턴트입니다. 친근하고 다정한 말투를 사용하세요.

당신의 역할:
1. 사용자의 물건 목록을 분석하고, 정리를 도와주세요.
2. 물건의 사용 빈도를 확인하기 위해 하나씩 질문하세요.
3. 오래 안 쓴 물건은 정중하게 폐기를 권유하세요.
4. 위치가 부적절한 물건은 더 나은 위치를 추천하세요.
5. 한 번에 너무 많은 질문을 하지 말고, 1-2개씩 물어보세요.
6. 사용자가 부담 느끼지 않도록 격려해주세요.

사용자의 현재 물건 목록:
${JSON.stringify(items, null, 2)}

답변은 반드시 한국어로 해주세요. 이모지를 적절히 활용해주세요.`;

  const contents = [
    ...chatHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    system: systemPrompt,
    contents,
  });

  return response.text;
}

/**
 * Get initial organization recommendations for items.
 * @param {Array} items - Items to analyze
 * @returns {Promise<string>} - Recommendations text
 */
export async function getRecommendations(items) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `다음 물건 목록을 분석해서 정리 추천을 해주세요. 보관/폐기/재배치를 제안해주세요.

물건 목록:
${JSON.stringify(items, null, 2)}

각 물건에 대해 간단한 추천을 해주세요. 이모지를 활용해주세요.`,
          },
        ],
      },
    ],
  });

  return response.text;
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
          refIndex: { type: Type.INTEGER, description: '물건의 번호 (1부터 시작)' },
          size: {
            type: Type.STRING,
            enum: ['tiny', 'small', 'medium', 'large'],
          },
          explanation: { type: Type.STRING },
        },
        required: ['refIndex', 'size'],
      },
    },
  },
  required: ['updatedItems'],
};

export async function recalibrateItemSizes(referenceItem, newSize, allItems) {
  const sizeOrder = ['tiny', 'small', 'medium', 'large'];
  const oldIndex = sizeOrder.indexOf(referenceItem.size || 'small');
  const newIndex = sizeOrder.indexOf(newSize);
  // 기준 물건의 크기 단계 변화량 (예: medium(2) -> small(1) 이면 delta = -1)
  const delta = newIndex !== -1 && oldIndex !== -1 ? newIndex - oldIndex : 0;

  // 비례 계산 안전 폴백 함수
  const fallbackRecalibrate = () => {
    return allItems.map((item, idx) => {
      const isRef = item.id ? item.id === referenceItem.id : item.name === referenceItem.name;
      if (isRef) {
        return {
          id: item.id,
          name: item.name,
          size: newSize,
          explanation: '기준 물건 직접 지정',
        };
      }
      const curIdx = sizeOrder.indexOf(item.size || 'small');
      // 기준 물건이 작아졌다면 다른 물건들도 상대적으로 작아지고, 커졌다면 커짐
      const adjustedIdx = Math.max(0, Math.min(3, curIdx + delta));
      return {
        id: item.id,
        name: item.name,
        size: sizeOrder[adjustedIdx],
        explanation: `'${referenceItem.name}' 기준 비례 스케일 자동 보정`,
      };
    });
  };

  const sizeLabels = {
    tiny: '아주 작음 (손가락 크기)',
    small: '작음 (손바닥 크기)',
    medium: '보통 (팔뚝 크기)',
    large: '큼 (그 이상 크기)',
  };

  const prompt = `당신은 사진 속 사물의 상대적 크기와 3D 비례를 분석하는 AI 전문가입니다.
동일한 사진 속에 함께 찍힌 물건들 중 하나인 "${referenceItem.name}"의 실제 크기가 "${sizeLabels[newSize] || newSize}"(으)로 확인되었습니다.
(이전 추정 크기: ${sizeLabels[referenceItem.size] || referenceItem.size} -> 실제 크기: ${sizeLabels[newSize] || newSize})

${
  delta !== 0
    ? `기준 물건이 원래 생각보다 약 ${Math.abs(delta)}단계 더 ${delta < 0 ? '작습니다' : '큽니다'}. 따라서 같은 사진에 있는 다른 물건들도 이 비례에 맞춰 상대적 크기를 전반적으로 ${delta < 0 ? '더 작게(하향)' : '더 크게(상향)'} 조정해주세요.`
    : ''
}

크기 기준:
- tiny: 아주 작음 (손가락 크기 / 동전, 립밤, USB, 작은 틴케이스, 작은 클립 등)
- small: 작음 (손바닥 크기 / 스마트폰, 머그컵, 작은 앨범/상자, 데오드란트, 가위, 샴푸통 등)
- medium: 보통 (팔뚝 크기 / 일반 책, 태블릿, 분무기, 텀블러, 헤어드라이어 등)
- large: 큼 (그 이상 / 모니터, 대형 상자, 백팩 등)

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
  .join('\n')}

각 물건의 refIndex(1부터 시작하는 번호)와 재계산된 size를 응답하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: recalibrationSchema,
      },
    });

    const raw = response.text || '{}';
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.updatedItems && parsed.updatedItems.length > 0) {
      // refIndex를 기반으로 100% 매칭
      return parsed.updatedItems.map((u) => {
        const orig = allItems[u.refIndex - 1] || allItems.find((a) => a.name === u.name);
        return {
          id: orig?.id,
          name: orig?.name || u.name,
          size: u.size,
          explanation: u.explanation,
        };
      });
    }
    return fallbackRecalibrate();
  } catch (err) {
    console.warn('Gemini recalibrate failed, using proportional fallback:', err);
    return fallbackRecalibrate();
  }
}

