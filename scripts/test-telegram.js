const axios = require('axios');
require('dotenv').config();

// 텔레그램 연결 테스트 스크립트
async function testTelegramConnection() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  console.log('Telegram 연결 테스트를 시작합니다...');
  console.log(`토큰이 설정되어 있습니까? ${Boolean(TELEGRAM_BOT_TOKEN)}`);
  console.log(`채팅 ID가 설정되어 있습니까? ${Boolean(TELEGRAM_CHAT_ID)}`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('환경 변수 설정이 누락되었습니다. .env 파일을 확인하세요.');
    return;
  }
  
  // 1. Telegram API 서버에 ping 테스트
  try {
    console.log('Telegram API 서버에 ping 테스트 중...');
    const pingResponse = await axios.get('https://api.telegram.org');
    console.log(`Telegram API 서버 ping 성공: ${pingResponse.status}`);
  } catch (error) {
    console.error('Telegram API 서버 ping 실패:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('연결이 거부되었습니다. 네트워크 방화벽이나 프록시 설정을 확인하세요.');
    }
  }
  
  // 2. 봇 정보 확인
  try {
    console.log('봇 정보 확인 중...');
    const botInfoResponse = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    console.log('봇 정보 확인 성공:', botInfoResponse.data);
  } catch (error) {
    console.error('봇 정보 확인 실패:', error.message);
    if (error.response) {
      console.error('API 응답:', error.response.status, error.response.data);
    }
  }
  
  // 3. 메시지 전송 테스트
  try {
    console.log('테스트 메시지 전송 중...');
    const messageResponse = await axios({
      method: 'post',
      url: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      data: {
        chat_id: TELEGRAM_CHAT_ID,
        text: '🔍 연결 테스트 메시지입니다. 온비드 봇이 정상 작동 중입니다.',
        disable_notification: true
      },
      timeout: 10000
    });
    console.log('메시지 전송 성공:', messageResponse.data);
  } catch (error) {
    console.error('메시지 전송 실패:', error.message);
    if (error.response) {
      console.error('API 응답:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('네트워크 연결이 거부되었습니다. 다음을 확인하세요:');
      console.error('1. 방화벽이 외부 연결을 차단하고 있지 않은지');
      console.error('2. 프록시 서버 설정이 필요한지');
      console.error('3. 네트워크 연결 상태가 정상인지');
    }
  }
}

// 스크립트 실행
testTelegramConnection()
  .then(() => {
    console.log('테스트 완료');
  })
  .catch(error => {
    console.error('테스트 중 오류 발생:', error);
  }); 