import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [interval, setInterval] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState('hours');
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [nextCheck, setNextCheck] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const timerIdRef = useRef(null);
  const isRunningRef = useRef(isRunning);
  const [isLightningVisible, setIsLightningVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    isRunningRef.current = isRunning;
    console.log("useEffect: isRunning updated to", isRunning);
  }, [isRunning]);

  const handleIntervalChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setInterval(value === '' ? '' : parseInt(value));
    }
  };

  const handleIntervalUnitChange = (e) => {
    setIntervalUnit(e.target.value);
  };

  const getIntervalInMilliseconds = () => {
    switch (intervalUnit) {
      case 'minutes':
        return interval * 60 * 1000;      // 분 → 밀리초
      case 'hours':
        return interval * 60 * 60 * 1000; // 시간 → 밀리초
      default:
        return interval * 1000;           // 초 → 밀리초
    }
  };

  const doSearch = async (startTime) => {
    const now = startTime || new Date();
    setLastCheck(now);
    const nextTime = new Date(now.getTime() + getIntervalInMilliseconds());
    setNextCheck(nextTime);
    
    // 한국 시간으로 변환하여 로그에 남기기
    console.log(`doSearch: 검색 시작 시각: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}, 다음 검색 시간: ${nextTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    
    try {
      const response = await fetch(`/api/selenium?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '검색 중 오류 발생');
      }
      setResults(data);
      await saveSettings(now, nextTime); // isRunning 값은 기본값 사용 (현재 상태)
      return true;
    } catch (err) {
      console.error('doSearch: 검색 중 오류:', err);
      setError(err.message);
      return false;
    }
  };

  const scheduleNextSearch = (lastSearchStartTime) => {
    if (!isRunningRef.current) {
      console.log("scheduleNextSearch: isRunning false, 타이머 예약 취소");
      return;
    }
    const now = new Date();
    const elapsed = now - lastSearchStartTime;
    const remaining = Math.max(0, getIntervalInMilliseconds() - elapsed);
    console.log(`scheduleNextSearch: ${remaining / 1000}초 후에 타이머 설정 (현재: ${now.toLocaleString()}, 시작: ${new Date(lastSearchStartTime).toLocaleString()})`);
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    timerIdRef.current = setTimeout(async () => {
      console.log("타이머 콜백 실행: 현재:", new Date().toLocaleString());
      if (!isRunningRef.current) {
        console.log("타이머 콜백: isRunning false, 실행 중지");
        return;
      }
      const newSearchStartTime = new Date();
      console.log('타이머 콜백: 예약된 검색 실행 시작');
      await doSearch(newSearchStartTime);
      scheduleNextSearch(newSearchStartTime);
    }, remaining);
    console.log("scheduleNextSearch: 타이머 ID =", timerIdRef.current);
  };

  // 세 번째 매개변수를 추가해서 최신 isRunning 값을 명시적으로 전달할 수 있게 함
  const saveSettings = async (currentLastCheck, currentNextCheck, running = isRunning) => {
    try {
      const lastCheckToSave = currentLastCheck || lastCheck;
      const nextCheckToSave = currentNextCheck || nextCheck;

      // 한국 시간으로 변환하여 ISO 문자열로 저장
      const lastCheckKST = lastCheckToSave ? new Date(lastCheckToSave.getTime() + (9 * 60 * 60 * 1000)).toISOString() : null;
      const nextCheckKST = nextCheckToSave ? new Date(nextCheckToSave.getTime() + (9 * 60 * 60 * 1000)).toISOString() : null;

      console.log('saveSettings: 저장할 설정 값:', {
        keyword,
        interval,
        isRunning: running,
        lastCheck: lastCheckKST,
        nextCheck: nextCheckKST
      });

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          interval,
          isRunning: running,
          lastCheck: lastCheckKST,
          nextCheck: nextCheckKST
        }),
      });
      if (!response.ok) {
        throw new Error('설정 저장 실패');
      }
    } catch (err) {
      console.error('saveSettings: 설정 저장 중 오류:', err);
    }
  };

  const startSearch = async () => {
    if (!keyword) {
      setError('검색어를 입력해주세요.');
      return;
    }
    if (!interval || interval < 1) {
      setError('검색 주기는 1 이상이어야 합니다.');
      return;
    }
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
      console.log("startSearch: 기존 타이머 클리어");
    }
    setIsRunning(true);
    setError(null);
    console.log('startSearch: 검색 시작...');
    const searchStartTime = new Date();
    const success = await doSearch(searchStartTime);
    console.log('startSearch: 첫 검색 완료:', success ? '성공' : '실패');
    scheduleNextSearch(searchStartTime);
  };

  const stopSearch = () => {
    console.log('stopSearch: 검색 중지 요청');
    if (timerIdRef.current) {
      console.log("stopSearch: 타이머 클리어, 타이머 ID =", timerIdRef.current);
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    setIsRunning(false);
    setNextCheck(null);
    // false 값을 명시적으로 전달해서 저장
    saveSettings(lastCheck, null, false);
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('설정을 불러올 수 없습니다.');
      }
      const settings = await response.json();
      console.log("loadSettings: 받은 설정 데이터:", settings);
  
      setKeyword(settings.keyword || '');
      setInterval(parseInt(settings.interval) || 1);
      if (settings.lastCheck) setLastCheck(new Date(settings.lastCheck));
      if (settings.nextCheck) setNextCheck(new Date(settings.nextCheck));
  
      // ✅ 자동 검색 상태 복원
      if (settings.isRunning && settings.keyword) {
        setIsRunning(true);
        setTimeout(() => {
          startSearch();
        }, 500);
      }
  
      setError(null);
    } catch (err) {
      console.error('loadSettings: 설정 불러오기 오류:', err);
      setError('설정을 불러오는데 실패했습니다.');
    }
  };
  
  useEffect(() => {
    loadSettings();
    return () => {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
    };
  }, []);

  useEffect(() => {
    const showLightning = () => {
      setIsLightningVisible(true);
      setTimeout(() => setIsLightningVisible(false), 300);
    };
    const animationInterval = setInterval(showLightning, 3000);
    return () => clearInterval(animationInterval);
  }, []);

  return (
    <div className="container">
      <Head>
        <title>온비드 입찰물건 검색</title>
        <meta name="description" content="온비드 입찰물건 자동 검색" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="lightning-container">
        <div className={`lightning ${isLightningVisible ? 'visible' : ''}`} />
      </div>
      <main>
        <h1>🤖 온비드 입찰물건 알림 로봇</h1>
        <div className="search-form">
          <div className="input-row">
            <div className="input-group">
              <label htmlFor="keyword">물건 키워드</label>
              <input
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 사물함, 보관함"
                disabled={isRunning}
              />
            </div>
            <div className="input-group">
              <label htmlFor="interval">알림 주기</label>
              <div className="interval-input">
                <input
                  id="interval"
                  type="number"
                  value={interval}
                  onChange={handleIntervalChange}
                  min="1"
                  disabled={isRunning}
                  className="interval-number"
                />
                <select
                  value={intervalUnit}
                  onChange={handleIntervalUnitChange}
                  disabled={isRunning}
                  className="interval-unit-select"
                >
                  <option value="hours">시간</option>
                  <option value="minutes">분</option>
                  <option value="seconds">초</option>
                </select>
              </div>
            </div>
          </div>
          <button 
            className={isRunning ? 'stop-button' : 'start-button'}
            onClick={isRunning ? stopSearch : startSearch}
          >
            {isRunning ? '자동 검색 중지' : '자동 검색 시작'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {lastCheck && (
          <div className="status">
            <p>최근 검색: {new Date(lastCheck).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
            {isRunning && nextCheck && (
              <p>다음 검색: {new Date(nextCheck).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
            )}
          </div>
        )}
        {results && (
          <div className="results">
            <h2>검색 결과</h2>
            <div className="stats">
              <div className="stat-item">
                <span className="stat-label">총 입찰물건</span>
                <span className="stat-value">{results.results.length}개</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">새로운 물건</span>
                <span className="stat-value highlight">{results.newItemsCount}개</span>
              </div>
            </div>
            {results.newItems && results.newItems.length > 0 && (
              <div className="new-items">
                <h3>🦋 새로운 물건</h3>
                {results.newItems.map((item, index) => (
                  <div key={index} className="new-item">
                    <div className="new-item-row">
                      <span className="new-item-label">입찰물건</span>
                      <span className="new-item-value">{item.title}</span>
                    </div>
                    <div className="new-item-row">
                      <span className="new-item-label">입찰기간</span>
                      <span className="new-item-value">{item.bidDate}</span>
                    </div>
                    <div className="new-item-row">
                      <span className="new-item-label">공고보기</span>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="new-item-link">
                        링크 열기 ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {results.screenshot && (
              <>
                <img 
                  src={results.screenshot} 
                  alt="검색 결과 스크린샷" 
                  className="screenshot"
                  onClick={() => setIsModalOpen(true)}
                  style={{ cursor: 'pointer' }}
                />
                {isModalOpen && (
                  <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={() => setIsModalOpen(false)}>
                      <img 
                        src={results.screenshot} 
                        alt="검색 결과 스크린샷" 
                        className="modal-image"
                      />
                      <button 
                        className="modal-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsModalOpen(false);
                        }}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
      <style jsx>{`
        .container {
          min-height: 100vh;
          background: #ffffff;
          position: relative;
          overflow: hidden;
        }
        .lightning-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .lightning {
          position: absolute;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, transparent 0%, rgba(0, 242, 255, 0.2) 20%, #00f2ff 50%, rgba(0, 242, 255, 0.2) 80%, transparent 100%);
          opacity: 0;
          filter: blur(1px);
          box-shadow: 0 0 20px #00f2ff, 0 0 40px #00f2ff;
          transform: translateX(-100%);
        }
        .lightning.visible {
          animation: lightning-flash 0.3s ease-out;
        }
        @keyframes lightning-flash {
          0% {
            opacity: 0;
            transform: translateX(-100%);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(100%);
          }
        }
        main {
          position: relative;
          z-index: 2;
          padding: 40px 20px;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }
        h1 {
          font-size: 2.5rem;
          color: #1a1a1a;
          margin-bottom: 2rem;
          font-weight: 700;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .search-form {
          background: rgba(255, 255, 255, 0.9);
          padding: 2rem;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          margin: 20px 0;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
        }
        .input-row {
          display: flex;
          gap: 3rem;
          width: 100%;
          max-width: 800px;
          justify-content: center;
          align-items: flex-start;
        }
        .input-group {
          width: 200px;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #1a1a1a;
          font-weight: 500;
          font-size: 0.9rem;
        }
        input {
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          transition: all 0.3s ease;
          width: 100%;
        }
        input:focus {
          border-color: #00f2ff;
          box-shadow: 0 0 0 3px rgba(0, 242, 255, 0.1);
          outline: none;
        }
        input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }
        .interval-input {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .interval-number {
          width: calc(200px - 100px);
        }
        .interval-unit-select {
          padding: 12px 8px;
          font-size: 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          transition: all 0.3s ease;
          width: 80px;
        }
        .interval-unit-select:focus {
          border-color: #00f2ff;
          box-shadow: 0 0 0 3px rgba(0, 242, 255, 0.1);
          outline: none;
        }
        .interval-unit-select:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }
        button {
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          min-width: 200px;
        }
        .start-button {
          background: linear-gradient(135deg, #00f2ff, #00a8ff);
          color: white;
        }
        .stop-button {
          background: linear-gradient(135deg, #ff4d4d, #ff0000);
          color: white;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .error {
          color: #ff4d4d;
          margin: 10px 0;
          padding: 10px;
          background: rgba(255, 77, 77, 0.1);
          border-radius: 8px;
        }
        .status {
          margin: 20px 0;
          padding: 20px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        .status p {
          margin: 5px 0;
          color: #666;
        }
        .results {
          margin-top: 20px;
          text-align: left;
          background: rgba(255, 255, 255, 0.9);
          padding: 1.2rem;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        .results h2 {
          color: #1a1a1a;
          margin: 0 0 0.8rem 0;
          font-size: 1.8rem;
        }
        .stats {
          display: flex;
          gap: 2rem;
          margin-bottom: 1rem;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
        }
        .stat-value.highlight {
          color: #00f2ff;
        }
        .new-items {
          margin: 10px 0;
          padding: 20px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        .new-items h3 {
          font-size: 1.4rem;
          color: #1a1a1a;
          margin: 0 0 0.8rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #f0f0f0;
        }
        .new-item {
          padding: 15px;
          margin-bottom: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #00f2ff;
        }
        .new-item:last-child {
          margin-bottom: 0;
        }
        .new-item-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .new-item-row:last-child {
          margin-bottom: 0;
        }
        .new-item-label {
          width: 80px;
          font-size: 14px;
          color: #666;
          flex-shrink: 0;
        }
        .new-item-value {
          flex: 1;
          font-size: 15px;
          color: #1a1a1a;
          font-weight: 500;
        }
        .new-item-link {
          color: #00a8ff;
          text-decoration: none;
          font-weight: 500;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          transition: all 0.2s ease;
        }
        .new-item-link:hover {
          color: #0076ff;
          text-decoration: underline;
        }
        .screenshot {
          width: 100%;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease;
        }
        .screenshot:hover {
          transform: scale(1.05);
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          position: relative;
          background: white;
          padding: 20px;
          border-radius: 12px;
          max-width: 95vw;
          max-height: 95vh;
          overflow: auto;
        }
        .modal-image {
          width: 100%;
          height: auto;
          border-radius: 8px;
        }
        .modal-close {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          min-width: auto;
        }
        .modal-close:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: none;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
