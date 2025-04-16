const axios = require('axios');

// 텔레그램 봇 설정
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// 메시지 포맷팅 함수
function formatMessage(newItems, keyword, totalItems) {
  if (!newItems || newItems.length === 0) {
    return '🌀 새로 등록된 입찰공고가 없습니다.';
  }

  let message = `🔔 새로운 입찰공고가 등록되었습니다!\n\n`;
  
  newItems.forEach((item, index) => {
    message += `입찰물건 : ${item.name}\n\n`;
    message += `입찰기간 : ${item.period}\n\n`;
    message += `공고보기 : ${item.link}\n\n\n`;
  });

  return message;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 메소드입니다' });
  }

  try {
    const { newItems, keyword, totalItems } = req.body;
    
    if (!newItems || !Array.isArray(newItems)) {
      return res.status(400).json({ error: 'newItems 배열이 필요합니다' });
    }

    let message;
    if (newItems.length === 0) {
      message = '🌀 새로 등록된 입찰공고가 없습니다.';
    } else {
      // 모든 새로운 물건을 하나의 메시지로 통합
      message = `🔔 ${newItems.length}개의 새로운 입찰공고가 등록되었습니다!\n\n`;
      
      // 각 물건의 정보를 추가
      newItems.forEach((item, index) => {
        message += `입찰물건 : ${item.title}\n\n`;
        message += `입찰기간 : ${item.bidDate}\n\n`;
        message += `공고보기 : ${item.link}\n\n----------\n\n`;
      });
    }

    // 직접 텔레그램 API에 요청을 보내는 부분 - axios 사용으로
    try {
      console.log(`텔레그램 API 요청 시작: ${TELEGRAM_API_URL.replace(TELEGRAM_BOT_TOKEN, 'REDACTED')}`);
      
      const response = await axios({
        method: 'post',
        url: TELEGRAM_API_URL,
        data: {
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        },
        timeout: 10000, // 10초 타임아웃 설정
        proxy: false    // 프록시 사용 안함
      });
      
      console.log('텔레그램 API 응답:', response.status);
      
      return res.status(200).json({ 
        success: true, 
        message: '텔레그램 메시지 전송 완료',
        telegramResponse: response.data 
      });
    } catch (error) {
      console.error('텔레그램 API 직접 호출 실패:', error.message);
      
      if (error.response) {
        // 서버 응답이 있지만 에러 상태코드인 경우
        console.error('응답 데이터:', error.response.data);
        console.error('응답 상태:', error.response.status);
      } else if (error.request) {
        // 요청은 만들어졌지만 응답이 수신되지 않은 경우
        console.error('요청 데이터:', error.request);
      }
      
      throw new Error(`텔레그램 API 오류: ${error.message}`);
    }

  } catch (error) {
    console.error('텔레그램 메시지 전송 중 오류:', error);
    return res.status(500).json({ 
      error: '텔레그램 메시지 전송 중 오류가 발생했습니다',
      details: error.message 
    });
  }
} 