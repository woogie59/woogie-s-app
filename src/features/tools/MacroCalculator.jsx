import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';

const translateMacrosToFood = (carbsG, proteinG, fatG, meals = 3) => {
  const perMealCarbs = carbsG / meals;
  const perMealProtein = proteinG / meals;
  const perMealFat = fatG / meals;
  const carbsServings = perMealCarbs / 60;
  const proteinServings = perMealProtein / 30;
  const fatServings = perMealFat / 10;
  const fmt = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1));
  const fatLabel =
    fatServings <= 0.3 ? '견과류 조금' : fatServings <= 0.5 ? '아보카도 절반' : fatServings <= 1 ? '아보카도 1개' : `아보카도 ${fmt(fatServings)}개`;
  return {
    carbs: {
      servings: carbsServings,
      label: carbsServings < 0.5 ? '밥 반 공기' : `밥 ${fmt(carbsServings)}공기`,
      alt: `고구마 ${Math.max(1, Math.round(carbsServings * 2))}개`,
    },
    protein: {
      servings: proteinServings,
      label: proteinServings < 0.5 ? '닭가슴살 반 덩어리' : `손바닥 크기 ${fmt(proteinServings)}덩어리`,
      alt: `계란 ${Math.max(1, Math.round(proteinServings * 4))}개`,
    },
    fat: {
      servings: fatServings,
      label: fatLabel,
      alt: `아몬드 ${Math.max(5, Math.round(fatServings * 10))}알`,
    },
  };
};

const MacroCalculator = ({ user, setView, goBack }) => {
  const { showAlert } = useGlobalModal();
  const [goal, setGoal] = useState('diet');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('M');
  const [age, setAge] = useState('');
  const [result, setResult] = useState(null);
  const [showHandGuide, setShowHandGuide] = useState(false);

  const calculateMacros = () => {
    if (!height || !weight || !age) {
      showAlert({ message: '키, 몸무게, 나이를 모두 입력해주세요.' });
      return;
    }

    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age);

    if (h <= 0 || w <= 0 || a <= 0) {
      showAlert({ message: '올바른 값을 입력해주세요.' });
      return;
    }

    let bmr;
    if (gender === 'M') {
      bmr = 10 * w + 6.25 * h - 5 * a + 5;
    } else {
      bmr = 10 * w + 6.25 * h - 5 * a - 161;
    }

    const activityFactor = 1.375;
    const tdee = bmr * activityFactor;

    let proteinGPerKg, carbsPercent, fatPercent;

    switch (goal) {
      case 'body_profile':
        proteinGPerKg = 2.2;
        carbsPercent = 0.25;
        fatPercent = 0.35;
        break;
      case 'diet':
        proteinGPerKg = 1.8;
        carbsPercent = 0.35;
        fatPercent = 0.3;
        break;
      case 'muscle_gain':
        proteinGPerKg = 1.6;
        carbsPercent = 0.5;
        fatPercent = 0.25;
        break;
      default:
        proteinGPerKg = 1.8;
        carbsPercent = 0.35;
        fatPercent = 0.3;
    }

    const proteinG = w * proteinGPerKg;
    const proteinCal = proteinG * 4;

    const carbsCal = tdee * carbsPercent;
    const carbsG = carbsCal / 4;

    const fatCal = tdee * fatPercent;
    const fatG = fatCal / 9;

    const mealsPerDay = 4;
    const carbsPerMeal = Math.round(carbsG / mealsPerDay);
    const proteinPerMeal = Math.round(proteinG / mealsPerDay);
    const fatPerMeal = Math.round(fatG / mealsPerDay);

    setResult({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      totalCarbs: Math.round(carbsG),
      totalProtein: Math.round(proteinG),
      totalFat: Math.round(fatG),
      carbsPerMeal,
      proteinPerMeal,
      fatPerMeal,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 pb-20 overflow-y-auto">
      <BackButton onClick={() => (goBack ? goBack() : setView('client_home'))} label="Home" />

      <header className="text-center mb-6">
        <h2 className="text-2xl font-bold text-emerald-600 mb-2">🍽️ 매크로 계산기</h2>
        <p className="text-gray-500 text-sm">목표에 맞는 영양 가이드</p>
      </header>

      <div className="max-w-md mx-auto space-y-4 mb-8">
        <div>
          <label className="text-xs text-gray-500 ml-1 mb-2 block uppercase tracking-wider">목표 선택</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-600 outline-none"
          >
            <option value="body_profile">Body Profile (체지방 감량)</option>
            <option value="diet">Diet (다이어트)</option>
            <option value="muscle_gain">Muscle Gain (근육 증량)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 ml-1 mb-2 block">키 (cm)</label>
            <input
              type="number"
              placeholder="170"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 ml-1 mb-2 block">몸무게 (kg)</label>
            <input
              type="number"
              placeholder="70"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 ml-1 mb-2 block">나이</label>
            <input
              type="number"
              placeholder="30"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 ml-1 mb-2 block">성별</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-600 outline-none"
            >
              <option value="M">남성</option>
              <option value="F">여성</option>
            </select>
          </div>
        </div>

        <button
          onClick={calculateMacros}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all"
        >
          계산하기
        </button>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-4"
        >
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="text-emerald-600 font-bold mb-3">📊 기초 대사량 & 필요 칼로리</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">기초대사량 (BMR)</p>
                <p className="text-2xl font-bold text-slate-900">{result.bmr}</p>
                <p className="text-xs text-gray-600">kcal/일</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">하루 소모량 (TDEE)</p>
                <p className="text-2xl font-bold text-slate-900">{result.tdee}</p>
                <p className="text-xs text-gray-600">kcal/일</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="text-emerald-600 font-bold mb-3">🍽️ 하루 총량</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">탄수화물</span>
                <span className="text-xl font-bold text-blue-400">{result.totalCarbs}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">단백질</span>
                <span className="text-xl font-bold text-red-400">{result.totalProtein}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">지방</span>
                <span className="text-xl font-bold text-green-400">{result.totalFat}g</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-gray-100 rounded-xl p-5 border-2 border-emerald-600/20">
            <h3 className="text-emerald-600 font-bold mb-3 flex items-center gap-2">
              <span>⭐</span> 끼니당 (4끼 기준)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 font-medium">탄수화물</span>
                <span className="text-2xl font-bold text-blue-400">{result.carbsPerMeal}g</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 font-medium">단백질</span>
                <span className="text-2xl font-bold text-red-400">{result.proteinPerMeal}g</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 font-medium">지방</span>
                <span className="text-2xl font-bold text-green-400">{result.fatPerMeal}g</span>
              </div>
            </div>

            {(() => {
              const food = translateMacrosToFood(result.totalCarbs, result.totalProtein, result.totalFat, 3);
              return (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-emerald-600 font-bold mb-3 flex items-center gap-2">
                    <span>🍽️</span> 한 끼에 이만큼 (3끼 기준)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="text-2xl">🍚</span>
                      <div>
                        <p className="text-slate-900 font-medium">{food.carbs.label}</p>
                        <p className="text-gray-500 text-xs">또는 {food.carbs.alt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="text-2xl">🥩</span>
                      <div>
                        <p className="text-slate-900 font-medium">{food.protein.label}</p>
                        <p className="text-gray-500 text-xs">또는 {food.protein.alt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="text-2xl">🥑</span>
                      <div>
                        <p className="text-slate-900 font-medium">{food.fat.label}</p>
                        <p className="text-gray-500 text-xs">또는 {food.fat.alt}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <button
            onClick={() => setShowHandGuide(true)}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl py-3 text-gray-600 hover:text-emerald-600 transition"
          >
            <span className="text-xl">🖐️</span>
            <span>저울 없이 손으로 잴까요?</span>
          </button>

          <AnimatePresence>
            {showHandGuide && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHandGuide(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 p-4"
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-xl border-2 border-emerald-600/20 p-6 max-w-sm w-full"
                >
                  <h3 className="text-emerald-600 font-bold text-lg mb-4 flex items-center gap-2">
                    <span>🖐️</span> 손으로 잰다! 간단 가이드
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-2xl">🖐️</span>
                      <div>
                        <p className="font-bold text-slate-900">단백질</p>
                        <p className="text-gray-600">손바닥 크기 한 장</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-2xl">✊</span>
                      <div>
                        <p className="font-bold text-slate-900">채소</p>
                        <p className="text-gray-600">주먹 하나 분량</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-2xl">🤲</span>
                      <div>
                        <p className="font-bold text-slate-900">탄수화물</p>
                        <p className="text-gray-600">접었을 때 손 한 움큼</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-2xl">👍</span>
                      <div>
                        <p className="font-bold text-slate-900">지방</p>
                        <p className="text-gray-600">엄지 끝마디 크기</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs mt-4">저울 없이도 쉽게! 꾸준히만 하면 됩니다 💪</p>
                  <button
                    onClick={() => setShowHandGuide(false)}
                    className="mt-4 w-full py-3 bg-emerald-600 text-white font-bold rounded-xl"
                  >
                    알겠어요!
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-emerald-600 mb-2">📋 목표 전략</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              {goal === 'body_profile' && '고단백 저탄수로 체지방 줄이기! 근육은 지키고 오직 살만 빠지는 식단이에요.'}
              {goal === 'diet' && '균형 잡힌 비율로 건강하게! 무리 없이 꾸준히 하는 게 핵심이에요.'}
              {goal === 'muscle_gain' && '탄수화물 든든히! 근육 키울 에너지를 충분히 채워주는 식단이에요.'}
            </p>
          </div>
        </motion.div>
      )}

      {!result && (
        <div className="max-w-md mx-auto bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-600 leading-relaxed">
            💡 주 3~5회 운동하시면 이 수치가 딱이에요! 더 정확히 맞추고 싶으면 코치에게 문의하세요.
          </p>
        </div>
      )}
    </div>
  );
};

export default MacroCalculator;
