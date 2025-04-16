const fs = require('fs').promises;
const path = require('path');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const axios = require('axios');

// 검색 결과 저장 경로
const RESULTS_FILE = path.join(process.cwd(), 'data', 'search_results.json');

// 검색 결과를 저장하는 함수
async function saveResults(keyword, newItems) {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  // 기존 데이터 읽기
  let previousData = { items: [] };
  try {
    const fileContent = await fs.readFile(RESULTS_FILE, 'utf8');
    previousData = JSON.parse(fileContent);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('기존 데이터 읽기 실패:', err);
    }
  }

  // 기존 아이템과 새로운 아이템 합치기
  const updatedItems = [...(previousData.items || []), ...newItems];

  // 중복 제거 (혹시 모를 중복 방지)
  const uniqueItems = updatedItems.filter((item, index, self) =>
    index === self.findIndex(t => 
      t.title === item.title && t.bidDate === item.bidDate
    )
  );

  const data = {
    lastChecked: new Date().toISOString(),
    keyword,
    items: uniqueItems
  };

  await fs.writeFile(RESULTS_FILE, JSON.stringify(data, null, 2));
  console.log(`새로운 ${newItems.length}개의 물건이 저장되었습니다.`);
  return newItems;
}

// 이전 결과와 비교하여 새로운 물건을 찾는 함수
async function findNewItems(keyword, currentItems) {
  try {
    const fileContent = await fs.readFile(RESULTS_FILE, 'utf8');
    const previousData = JSON.parse(fileContent);
    
    const newItems = currentItems.filter(current => {
      const isNew = !previousData.items.some(prev => 
        prev.title === current.title && prev.bidDate === current.bidDate
      );
      if (isNew) {
        console.log('새로운 물건 발견:', current.title);
      }
      return isNew;
    });

    console.log(`이전 물건 수: ${previousData.items.length}, 현재 물건 수: ${currentItems.length}, 새로운 물건 수: ${newItems.length}`);
    return newItems;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('이전 검색 결과 파일이 없어 모든 물건을 새로운 물건으로 처리합니다.');
    } else {
      console.error('이전 결과 비교 중 오류:', err);
    }
    return currentItems;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않은 메소드입니다' });
  }
  
  const searchKeyword = req.query.keyword || '사물함';
  console.log(`검색어: ${searchKeyword}`);
  
  let driver = null;

  try {
    console.log('Selenium WebDriver 초기화 중...');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(
        new chrome.Options()
          .addArguments('--headless=new')
          .addArguments('--window-size=1920,1080')
          .addArguments('--hide-scrollbars')
          .addArguments('--force-device-scale-factor=2')
      )
      .build();

    console.log('온비드 웹사이트 접속 중...');
    await driver.get('https://www.onbid.co.kr');
    
    // 페이지 완전 로드를 위한 대기
    console.log('페이지 완전 로드를 위해 추가 대기 중...');
    await driver.wait(until.elementLocated(By.css('body')), 20000);
    await driver.sleep(2000);
    
    // 검색창 찾기
    console.log('검색창 찾기 시도...');
    const searchBox = await driver.findElement(By.xpath('//*[@id="query"]'));
    console.log('검색창을 찾았습니다.');
    
    // 검색어 입력
    console.log(`검색어 입력 중: ${searchKeyword}`);
    await driver.executeScript('arguments[0].value = "";', searchBox);
    await driver.executeScript(`arguments[0].value = "${searchKeyword}";`, searchBox);
    await driver.sleep(1000);
    
    // 검색 실행 (엔터 키 입력 대신 검색 버튼 클릭)
    console.log('검색 버튼 찾기 및 클릭...');
    try {
      // 검색 버튼 찾기 시도
      const searchButton = await driver.findElement(By.css('a.sch_btn, button.sch_btn'));
      // 클릭
      await driver.executeScript('arguments[0].click();', searchButton);
      console.log('검색 버튼 클릭 완료');
    } catch (error) {
      console.log('검색 버튼을 찾지 못해 폼 제출 시도:', error.message);
      
      try {
        // 폼 찾기 시도
        const form = await driver.findElement(By.css('form'));
        await driver.executeScript('arguments[0].submit();', form);
        console.log('폼 제출 완료');
      } catch (formError) {
        console.log('폼 제출 실패, JavaScript로 검색 이벤트 발생시키기:', formError.message);
        
        // JavaScript로 검색 기능 직접 호출 시도
        await driver.executeScript(`
          // 이벤트 핸들러 검색
          var searchFunctions = [];
          for (var key in window) {
            if (typeof window[key] === 'function' && 
                (key.toLowerCase().includes('search') || key.toLowerCase().includes('find'))) {
              searchFunctions.push(key);
            }
          }
          console.log('잠재적 검색 함수:', searchFunctions);
          
          // 검색 버튼 찾기 및 클릭 이벤트 발생
          var searchBtn = document.querySelector('a.sch_btn, button.sch_btn');
          if (searchBtn) {
            searchBtn.click();
            return true;
          }
          
          // form의 submit 이벤트 발생
          var form = document.querySelector('form');
          if (form) {
            form.submit();
            return true;
          }
          
          // Enter 키 이벤트 시뮬레이션
          var searchInput = document.getElementById('query');
          if (searchInput) {
            var event = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            searchInput.dispatchEvent(event);
            return true;
          }
          
          return false;
        `);
        console.log('JavaScript 검색 이벤트 발생 시도 완료');
      }
    }
    
    // 추가 대기 시간 (검색 결과 로딩을 위해)
    console.log('검색 결과 로딩 대기 중...');
    await driver.sleep(2000);  // 대기 시간 증가
    
    // 현재 URL 확인 및 페이지 소스 로깅
    console.log('검색 후 현재 URL 확인...');
    const currentUrl = await driver.getCurrentUrl();
    console.log('현재 URL:', currentUrl);
    
    // 페이지 소스의 일부를 로깅하여 디버깅에 도움이 되도록 함
    const pageSource = await driver.getPageSource();
    console.log('페이지 소스 길이:', pageSource.length);
    console.log('페이지에 "입찰물건" 텍스트 포함 여부:', pageSource.includes('입찰물건'));
    
    // 페이지 제목 확인
    const pageTitle = await driver.getTitle();
    console.log('현재 페이지 제목:', pageTitle);
    
    // 입찰물건 탭 찾기
    console.log('입찰물건 탭 찾기 시도...');
    let tabButton;
    try {
      tabButton = await driver.findElement(By.xpath('//*[@id="_searchTap"]/li[3]/a'));
      console.log('입찰물건 탭을 찾았습니다.');
    } catch (error) {
      console.log('입찰물건 탭을 찾지 못했습니다. 다른 방법으로 시도합니다:', error.message);
      
      try {
        // 텍스트로 찾기 시도
        console.log('텍스트로 탭 찾기 시도...');
        tabButton = await driver.findElement(By.xpath('//a[contains(text(), "입찰물건")]'));
        console.log('텍스트로 입찰물건 탭을 찾았습니다.');
      } catch (err) {
        console.log('텍스트로도 찾지 못했습니다:', err.message);
        
        try {
          // 스크린샷 찍기 (디버깅용)
          console.log('디버깅을 위해 스크린샷 저장...');
          const screenshotPath = path.join(process.cwd(), 'search-debug.png');
          const screenshot = await driver.takeScreenshot();
          await fs.writeFile(screenshotPath, screenshot, 'base64');
          console.log('스크린샷 저장 완료:', screenshotPath);
          
          // 입찰정보 직접 접근 시도
          console.log('입찰정보 페이지로 직접 이동 시도...');
          await driver.get('https://www.onbid.co.kr/op/ppa/selectPublicSaleList.do');
          await driver.sleep(2000);
          
          // 검색어 다시 입력
          console.log('검색어 다시 입력 시도...');
          try {
            const searchBoxAgain = await driver.findElement(By.xpath('//*[@id="searchword"]'));
            await driver.executeScript('arguments[0].value = "";', searchBoxAgain);
            await driver.executeScript(`arguments[0].value = "${searchKeyword}";`, searchBoxAgain);
            
            // 검색 버튼 클릭
            const searchButtonAgain = await driver.findElement(By.xpath('//*[@id="frm"]/div[2]/div/a[1]'));
            await driver.executeScript('arguments[0].click();', searchButtonAgain);
            console.log('입찰정보 페이지에서 검색 완료');
            await driver.sleep(2000);
          } catch (directError) {
            console.log('직접 접근 시도 실패:', directError.message);
            throw new Error('입찰물건 탭을 찾을 수 없고 직접 접근도 실패했습니다.');
          }
        } catch (screenshotError) {
          console.log('스크린샷 저장 중 오류:', screenshotError.message);
          throw new Error('입찰물건 탭을 찾을 수 없습니다.');
        }
      }
    }
    
    // 탭 클릭 (이미 입찰정보 페이지에 있는 경우 이 단계는 건너뜁니다)
    if (tabButton) {
      console.log('탭 버튼 클릭 시도...');
      await driver.executeScript('arguments[0].click();', tabButton);
      console.log('탭 버튼 클릭 완료');
      await driver.sleep(2000);
    }
    
    // 검색 결과 수집
    console.log('검색 결과 수집 중...');
    const rows = await driver.findElements(By.xpath('//*[@id="_list_body"]/table/tbody/tr'));
    console.log(`${rows.length}개의 입찰물건을 찾았습니다.`);
    
    const results = [];
    const uniqueKeys = new Set(); // 중복 체크를 위한 Set
    
    // 각 행에서 정보 추출
    for (let i = 0; i < rows.length; i++) {
      try {
        const rowNum = i + 1;
        
        // 입찰물건명
        const nameElement = await driver.findElement(
          By.xpath(`//*[@id="_list_body"]/table/tbody/tr[${rowNum}]/td[1]/span/span[2]`)
        );
        const title = await nameElement.getText();
        
        // 입찰기간
        const periodElement = await driver.findElement(
          By.xpath(`//*[@id="_list_body"]/table/tbody/tr[${rowNum}]/td[3]`)
        );
        const bidDate = await periodElement.getText();
        
        // 입찰공고 링크
        const linkElement = await driver.findElement(
          By.xpath(`//*[@id="_list_body"]/table/tbody/tr[${rowNum}]/td[1]/span/span[1]/a`)
        );
        const link = await linkElement.getAttribute('href');
        
        // 중복 체크 (제목+입찰기간 조합으로 중복 확인)
        const uniqueKey = `${title}-${bidDate}`;
        if (uniqueKeys.has(uniqueKey)) {
          console.log(`중복된 입찰물건 발견, 무시함: ${title}`);
          continue; // 중복된 경우 건너뛰기
        }
        uniqueKeys.add(uniqueKey);
        
        // 키워드별 필터링 적용
        if (searchKeyword === '사물함') {
          // 사물함 검색일 경우 도서관 또는 교육연구시설이 포함된 공고만 필터링
          const lowerTitle = title.toLowerCase();
          if (lowerTitle.includes('도서관') || lowerTitle.includes('교육연구시설')) {
            console.log(`필터링된 사물함 공고 추가: ${title}`);
            results.push({ title, bidDate, link });
          } else {
            console.log(`필터링에서 제외된 사물함 공고: ${title}`);
          }
        } else if (searchKeyword === '보관함') {
          // 보관함 검색일 경우 보관함이 포함된 공고만 필터링
          const lowerTitle = title.toLowerCase();
          if (lowerTitle.includes('보관함')) {
            console.log(`필터링된 보관함 공고 추가: ${title}`);
            results.push({ title, bidDate, link });
          } else {
            console.log(`필터링에서 제외된 보관함 공고: ${title}`);
          }
        } else {
          // 다른 키워드에 대해서는 필터링 없이 모든 결과 포함
          console.log(`일반 검색 공고 추가: ${title}`);
          results.push({ title, bidDate, link });
        }
      } catch (error) {
        console.log(`${i + 1}번째 입찰물건 정보 추출 중 오류:`, error.message);
        break;
      }
    }

    console.log(`필터링 및 중복 제거 후 ${results.length}개의 입찰물건이 남았습니다.`);

    // 새로운 물건 찾기
    const newItems = await findNewItems(searchKeyword, results);
    console.log(`새로운 물건 수: ${newItems.length}개`);

    // 새로운 물건이 있는 경우에만 저장
    if (newItems.length > 0) {
      await saveResults(searchKeyword, newItems);
    }

    // 텔레그램으로 알림 보내기 (새로운 물건이 있거나 없을 때 모두)
    console.log('텔레그램으로 메시지 전송 중...');
    try {
      // 직접 텔레그램 API에 요청 - 로컬 API 우회
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error('텔레그램 설정이 올바르지 않습니다. 환경 변수를 확인하세요.');
      }
      
      // 메시지 생성
      let message;
      if (newItems.length === 0) {
        message = '🌀 새로 등록된 입찰공고가 없습니다.';
      } else {
        message = `🔔 ${newItems.length}개의 새로운 입찰공고가 등록되었습니다!\n\n`;
        
        newItems.forEach((item) => {
          message += `입찰물건 : ${item.title}\n\n`;
          message += `입찰기간 : ${item.bidDate}\n\n`;
          message += `공고보기 : ${item.link}\n\n----------\n\n`;
        });
      }
      
      // 직접 텔레그램 API 호출
      const telegramResponse = await axios({
        method: 'post',
        url: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        data: {
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        },
        timeout: 10000, // 10초 타임아웃
        proxy: false    // 프록시 사용 안함
      });
      
      console.log('텔레그램 전송 완료:', telegramResponse.status);
    } catch (telegramError) {
      console.error('텔레그램 전송 중 오류:', telegramError);
      
      // 자세한 에러 정보 로깅
      if (telegramError.response) {
        // 서버 응답이 있지만 에러인 경우
        console.error('텔레그램 API 응답:', telegramError.response.status, telegramError.response.data);
      } else if (telegramError.request) {
        // 요청은 성공했지만 응답이 없는 경우
        console.error('텔레그램 요청 시 응답 없음');
      }
    }

    // 전체 페이지 스크린샷 캡처
    console.log('입찰공고 스크린샷 캡처 중...');
    
    try {
      // CDP 세션 생성
      const session = await driver.createCDPConnection('page');
      
      // 정확한 테이블 위치 찾기 및 스타일링
      const tableRect = await driver.executeScript(`
        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            try {
              // XPath로 테이블 컨테이너 찾기
              const xpath = '//*[@id="tab-1"]/div[2]/div[2]/div[1]';
              const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              const container = result.singleNodeValue;
              
              if (!container) {
                throw new Error('입찰물건 테이블을 찾을 수 없습니다.');
              }

              // 컨테이너 스타일링
              container.style.margin = '0';
              container.style.padding = '0';
              container.style.width = '1920px';
              container.style.backgroundColor = 'white';

              // 테이블 스타일링
              const table = container.querySelector('table');
              if (table) {
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                table.style.tableLayout = 'fixed';
                
                // 셀 스타일링
                const cells = table.querySelectorAll('td, th');
                cells.forEach(cell => {
                  cell.style.padding = '15px';
                  cell.style.border = '1px solid #dee2e6';
                  cell.style.textAlign = 'left';
                });

                // 컬럼 너비 설정
                const headerRow = table.querySelector('tr');
                if (headerRow) {
                  const columns = headerRow.cells;
                  if (columns.length >= 6) {
                    columns[0].style.width = '45%';  // 물건명
                    columns[1].style.width = '10%';  // 관리번호
                    columns[2].style.width = '15%';  // 입찰기간
                    columns[3].style.width = '10%';  // 입찰금액
                    columns[4].style.width = '10%';  // 입찰방식
                    columns[5].style.width = '10%';  // 상태
                  }
                }
              }

              // 정확한 위치 계산
              const rect = container.getBoundingClientRect();
              
              // 스크롤 초기화
              window.scrollTo(0, rect.top);
              
              resolve({
                x: Math.floor(rect.left),
                y: Math.floor(rect.top),
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height)
              });
            } catch (error) {
              console.error('테이블 준비 중 오류:', error);
              resolve(null);
            }
          });
        });
      `);

      if (!tableRect) {
        throw new Error('테이블 위치를 계산할 수 없습니다.');
      }

      console.log('테이블 크기:', tableRect);

      // 뷰포트 크기 설정
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: tableRect.height,
        deviceScaleFactor: 2,
        mobile: false
      });

      // 추가 렌더링 대기
      await driver.sleep(1000);

      // 스크린샷 캡처
      const screenshot = await driver.takeScreenshot();
      
      // 스크린샷 저장
      const screenshotPath = path.join(process.cwd(), 'public', 'screenshots', `${Date.now()}.png`);
      await fs.mkdir(path.join(process.cwd(), 'public', 'screenshots'), { recursive: true });
      await fs.writeFile(screenshotPath, screenshot, 'base64');
      
      // 상대 경로로 변환
      const relativePath = `/screenshots/${path.basename(screenshotPath)}`;

      // WebDriver 종료
      await driver.quit();
      driver = null;
      
      return res.status(200).json({
        title: `온비드 '${searchKeyword}' 검색 결과`,
        results,
        newItemsCount: newItems.length,
        newItems: newItems,
        screenshot: relativePath
      });
    } catch (screenshotError) {
      console.error('스크린샷 캡처 중 오류:', screenshotError);
      if (driver) {
        await driver.quit();
        driver = null;
      }
      
      return res.status(200).json({
        title: `온비드 '${searchKeyword}' 검색 결과`,
        results,
        newItemsCount: newItems.length,
        newItems: newItems,
        screenshot: null
      });
    }
    
  } catch (error) {
    console.error('에러 발생:', error);
    
    if (driver) {
      try {
        await driver.quit();
      } catch (quitError) {
        console.error('드라이버 종료 중 에러:', quitError);
      }
    }
    
    return res.status(500).json({ 
      error: '검색 중 오류가 발생했습니다', 
      details: error.message 
    });
  }
} 