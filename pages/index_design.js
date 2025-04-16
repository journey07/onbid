import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [interval, setInterval] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [nextCheck, setNextCheck] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const timerIdRef = useRef(null);
  const isRunningRef = useRef(isRunning);
  const [isLightningVisible, setIsLightningVisible] = useState(false);

  useEffect(() => {
    isRunningRef.current = isRunning;
    console.log("useEffect: isRunning updated to", isRunning);
  }, [isRunning]);

  const doSearch = async (startTime) => {
    const now = startTime || new Date();
    setLastCheck(now);
    const nextTime = new Date(now.getTime() + interval * 1000);
    setNextCheck(nextTime);
    console.log(`doSearch: 검색 시작 시각: ${now.toLocaleString()}, 다음 검색 시간: ${nextTime.toLocaleString()}`);
    try {
      const response = await fetch(`/api/selenium?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '검색 중 오류 발생');
      }
      setResults(data);
      await saveSettings(now, nextTime);
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
    const remaining = Math.max(0, interval * 1000 - elapsed);
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

  const saveSettings = async (currentLastCheck, currentNextCheck) => {
    try {
      const lastCheckToSave = currentLastCheck || lastCheck;
      const nextCheckToSave = currentNextCheck || nextCheck;
      console.log('saveSettings: 저장할 설정 값:', {
        keyword,
        interval,
        isRunning,
        lastCheck: lastCheckToSave ? lastCheckToSave.toISOString() : null,
        nextCheck: nextCheckToSave ? nextCheckToSave.toISOString() : null
      });
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          interval,
          isRunning: false,
          lastCheck: lastCheckToSave,
          nextCheck: nextCheckToSave
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
      setError('검색 주기는 1초 이상이어야 합니다.');
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
    saveSettings(lastCheck, null);
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
      setInterval(parseInt(settings.interval) || 60);
      if (settings.lastCheck) setLastCheck(new Date(settings.lastCheck));
      if (settings.nextCheck) setNextCheck(new Date(settings.nextCheck));
      setIsRunning(false);
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

  const handleIntervalChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setInterval(value === '' ? '' : parseInt(value));
    }
  };

  return (
    <div className="container flex items-center justify-between p-4">
      <div className="robot-image w-1/2">
        <img src="/public/robot.png" alt="Robot" className="w-full h-auto" />
      </div>
      <div className="search-form w-1/2">
        <h1>🤖 온비드 입찰물건 알림 로봇</h1>
        <div className="input-row">
          <div className="input-group">
            <label htmlFor="keyword">물건 키워드</label>
            <input
              id="keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 아파트"
              disabled={isRunning}
            />
          </div>
          <div className="input-group">
            <label htmlFor="interval">알림 주기</label>
            <input
              id="interval"
              type="number"
              value={interval}
              onChange={handleIntervalChange}
              min="1"
              disabled={isRunning}
            />
          </div>
        </div>
        <button onClick={isRunning ? stopSearch : startSearch}>
          {isRunning ? '자동 검색 중지' : '자동 검색 시작'}
        </button>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
