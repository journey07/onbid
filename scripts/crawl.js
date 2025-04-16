const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 환경 변수에서 검색어와 텔레그램 설정 가져오기
const SEARCH_KEYWORD = process.env.SEARCH_KEYWORD || '보관함';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function crawlOnbid() {
  let driver;
  try {
    // Chrome 옵션 설정
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

    // WebDriver 초기화
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    // 온비드 웹사이트 접속
    await driver.get('https://www.onbid.co.kr');

    // 페이지 완전 로드를 위해 추가 대기
    await driver.wait(until.elementLocated(By.css('body')), 5000);

    // 검색창 찾기
    let searchBox;
    try {
      searchBox = await driver.findElement(By.css('input[name="searchKeyword"]'));
    } catch (err) {
      try {
        searchBox = await driver.executeScript(`
          return document.querySelector('input[name="searchKeyword"]') ||
                 document.querySelector('input[placeholder*="검색"]') ||
                 document.querySelector('input[type="text"]');
        `);
      } catch (err) {
        throw new Error('검색창을 찾을 수 없습니다.');
      }
    }

    // 검색어 입력
    await searchBox.clear();
    await searchBox.sendKeys(SEARCH_KEYWORD);

    // 검색 버튼 찾기 및 클릭
    try {
      const searchButton = await driver.findElement(By.css('button[type="submit"]'));
      await searchButton.click();
    } catch (err) {
      await searchBox.sendKeys(Key.RETURN);
    }

    // 검색 결과 로딩 대기
    try {
      await driver.wait(until.elementLocated(By.css('.search_result')), 5000);
    } catch (err) {
      console.log('검색 결과 로딩 대기 시간 초과, 계속 진행...');
    }

    // 입찰물건 탭 찾기
    let tabButton;
    try {
      tabButton = await driver.findElement(By.xpath('//*[@id="_searchTap"]/li[3]/a'));
    } catch (err) {
      try {
        tabButton = await driver.findElement(By.xpath('//a[contains(text(), "입찰물건")]'));
      } catch (err) {
        tabButton = await driver.executeScript(`
          return Array.from(document.querySelectorAll('a')).find(el => el.textContent.includes('입찰물건'));
        `);
      }
    }

    // 탭 클릭
    try {
      await tabButton.click();
    } catch (err) {
      await driver.executeScript('arguments[0].click();', tabButton);
    }

    // 탭 클릭 후 대기
    await driver.sleep(1000);

    // 검색 결과 수집
    const results = await driver.executeScript(`
      const items = Array.from(document.querySelectorAll('.search_result li'));
      return items.map(item => {
        const name = item.querySelector('.item_name')?.textContent.trim() || '';
        const period = item.querySelector('.item_period')?.textContent.trim() || '';
        const link = item.querySelector('a')?.href || '';
        return { name, period, link };
      });
    `);

    // 스크린샷 저장
    const screenshot = await driver.takeScreenshot();
    const screenshotPath = path.join(process.cwd(), 'public', 'screenshot.png');
    await fs.writeFile(screenshotPath, screenshot, 'base64');

    // 텔레그램으로 결과 전송
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const message = formatMessage(results);
      await sendTelegramMessage(message);
    }

    return {
      success: true,
      results,
      screenshot: '/screenshot.png'
    };

  } catch (error) {
    console.error('크롤링 중 오류 발생:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

function formatMessage(results) {
  if (!results || results.length === 0) {
    return '🌀 새로 등록된 입찰공고가 없습니다.';
  }

  const newItems = results.filter(item => item.name && item.period);
  if (newItems.length === 0) {
    return '🌀 새로 등록된 입찰공고가 없습니다.';
  }

  let message = '🔔 새로운 입찰공고가 등록되었습니다!\n\n';
  
  newItems.forEach(item => {
    message += `입찰물건 : ${item.name}\n\n`;
    message += `입찰기간 : ${item.period}\n\n`;
    if (item.link) {
      message += `공고보기 : ${item.link}\n\n`;
    }
    message += '-------------------\n\n';
  });

  return message;
}

async function sendTelegramMessage(message) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      }
    );
    console.log('텔레그램 전송 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('텔레그램 전송 실패:', error);
    throw error;
  }
}

// Export the functions for use as a module
module.exports = {
  crawlOnbid,
  formatMessage,
  sendTelegramMessage
};

// Only run the script directly if it's the main module
if (require.main === module) {
  crawlOnbid()
    .then(result => {
      console.log('크롤링 결과:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('스크립트 실행 중 오류:', error);
      process.exit(1);
    });
} 