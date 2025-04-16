import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

// settings.json 파일이 없으면 생성
if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
}

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
    keyword: '',
    interval: 60,
    isRunning: false,
    lastCheck: null,
    nextCheck: null
  }));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      
      // 날짜 값 검증 로깅
      if (settings.lastCheck) {
        console.log('저장된 마지막 검색 시간:', settings.lastCheck);
      }
      if (settings.nextCheck) {
        console.log('저장된 다음 검색 시간:', settings.nextCheck);
      }
      
      res.status(200).json(settings);
    } catch (error) {
      console.error('설정 파일 읽기 오류:', error);
      res.status(500).json({ error: '설정을 불러오는데 실패했습니다.' });
    }
  } else if (req.method === 'POST') {
    try {
      const currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      
      // 입력값 로깅
      console.log('받은 설정 데이터:', {
        interval: req.body.interval,
        lastCheck: req.body.lastCheck,
        nextCheck: req.body.nextCheck
      });
      
      let lastCheckDate = null;
      if (req.body.lastCheck) {
        try {
          lastCheckDate = new Date(req.body.lastCheck).toISOString();
        } catch (err) {
          console.error('lastCheck 날짜 변환 오류:', err);
        }
      }
      
      let nextCheckDate = null;
      if (req.body.nextCheck) {
        try {
          nextCheckDate = new Date(req.body.nextCheck).toISOString();
        } catch (err) {
          console.error('nextCheck 날짜 변환 오류:', err);
        }
      }
      
      // interval은 반드시 숫자로 변환
      let intervalValue = 60;
      if (req.body.interval !== undefined) {
        const parsed = parseInt(req.body.interval);
        intervalValue = isNaN(parsed) ? 60 : parsed;
      }
      
      const settings = {
        ...currentSettings,
        ...req.body,
        interval: intervalValue,
        lastCheck: lastCheckDate,
        nextCheck: nextCheckDate
      };
      
      // 저장할 설정 로깅
      console.log('저장할 설정:', {
        interval: settings.interval,
        lastCheck: settings.lastCheck,
        nextCheck: settings.nextCheck
      });
      
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      res.status(200).json(settings);
    } catch (error) {
      console.error('설정 파일 저장 오류:', error);
      res.status(500).json({ error: '설정 저장에 실패했습니다.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 