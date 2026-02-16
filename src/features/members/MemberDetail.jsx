import React, { useState, useEffect } from 'react';
import { CreditCard, History, Plus, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';

const MemberDetail = ({ selectedMemberId, setView }) => {
  const { showAlert, showConfirm } = useGlobalModal();
  const [u, setU] = useState(null);
  const [batches, setBatches] = useState([]);
  const [addAmount, setAddAmount] = useState('');
  const [priceInput, setPriceInput] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const fetchMemberDetails = async () => {
    const { data: userData } = await supabase.from('profiles').select('*').eq('id', selectedMemberId).single();
    setU(userData);
    setPriceInput(userData?.price_per_session || 0);

    setLoadingBatches(true);
    const { data: batchData, error: batchError } = await supabase
      .from('session_batches')
      .select('*')
      .eq('user_id', selectedMemberId)
      .gt('remaining_count', 0)
      .order('created_at', { ascending: true });

    if (batchError) {
      console.error('Error fetching batches:', batchError);
      setBatches([]);
    } else {
      setBatches(batchData || []);
    }

    const { data: noteData } = await supabase
      .from('trainer_notes')
      .select('content')
      .eq('user_id', selectedMemberId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setNoteContent(noteData?.content ?? '');

    setLoadingBatches(false);
  };

  useEffect(() => {
    fetchMemberDetails();
  }, [selectedMemberId]);

  const totalRemaining =
    batches.length > 0 ? batches.reduce((sum, batch) => sum + batch.remaining_count, 0) : u?.remaining_sessions || 0;

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      const { error } = await supabase.from('trainer_notes').insert({
        user_id: selectedMemberId,
        content: noteContent,
      });
      if (error) throw error;
      showAlert({ message: 'Saved!' });
    } catch (err) {
      console.error('Save note error:', err);
      showAlert({ message: '저장 실패: ' + (err?.message || 'Unknown error') });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddSession = () => {
    if (!addAmount || isNaN(addAmount)) {
      showAlert({ message: '세션 횟수를 입력해주세요.' });
      return;
    }
    if (priceInput === null || priceInput === '' || isNaN(priceInput)) {
      showAlert({ message: '유효한 단가를 입력해주세요.' });
      return;
    }

    const sessionAmount = parseInt(addAmount);
    const priceValue = parseInt(priceInput);

    if (sessionAmount <= 0) {
      showAlert({ message: '세션 횟수는 1 이상이어야 합니다.' });
      return;
    }
    if (priceValue < 0) {
      showAlert({ message: '단가는 0 이상이어야 합니다.' });
      return;
    }

    const confirmMessage = `${u.name}님에게\n• 세션 ${sessionAmount}회 추가\n• 단가: ${priceValue.toLocaleString()}원/회\n\n새로운 티켓을 생성하시겠습니까?`;
    showConfirm({
      title: '티켓 추가',
      message: confirmMessage,
      confirmLabel: '생성',
      onConfirm: async () => {
        const { error } = await supabase.rpc('admin_add_session_batch', {
          target_user_id: selectedMemberId,
          sessions_to_add: sessionAmount,
          price: priceValue,
        });
        if (error) throw new Error(error.message);
        showAlert({ message: `✓ 새 티켓 추가 완료!\n• ${sessionAmount}회\n• ${priceValue.toLocaleString()}원/회` });
        setAddAmount('');
        await fetchMemberDetails();
      },
    });
  };

  if (!u)
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-500">Loading...</div>
    );

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20 relative">
      <BackButton onClick={() => setView('member_list')} label="Client List" />

      <header className="flex items-center justify-center mb-6">
        <h2 className="text-lg font-serif text-yellow-500">{u?.name}</h2>
      </header>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-6 rounded-2xl border border-zinc-700/50 relative overflow-hidden shadow-xl">
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-zinc-400 text-sm tracking-widest uppercase">Total Remaining</span>
              <span className="text-4xl font-serif text-yellow-500">{totalRemaining}</span>
            </div>
            <p className="text-zinc-500 text-xs">{u.email}</p>
            {batches.length > 0 && (
              <p className="text-zinc-600 text-xs mt-1">
                {batches.length} active ticket{batches.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard size={100} className="text-white" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History size={16} className="text-yellow-500" />
            Active Session Packs
          </h3>

          {loadingBatches ? (
            <p className="text-zinc-500 text-center py-6">Loading tickets...</p>
          ) : batches.length > 0 ? (
            <div className="space-y-3">
              {batches.map((batch, index) => {
                const isInUse = index === 0;
                const batchDate = new Date(batch.created_at)
                  .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                  .replace(/\. /g, '.')
                  .replace(/\.$/, '');

                return (
                  <div
                    key={batch.id}
                    className={`bg-zinc-950 rounded-lg p-4 transition-all ${
                      isInUse ? 'border-2 border-yellow-600/70 bg-yellow-600/5' : 'border border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={14} className={isInUse ? 'text-yellow-500' : 'text-zinc-500'} />
                          <span className="text-sm text-zinc-400">{batchDate}</span>
                          {isInUse && (
                            <span className="text-xs bg-yellow-600 text-black font-bold px-2 py-0.5 rounded">IN USE</span>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-xs text-zinc-500 block mb-1">🎫 Status</span>
                            <span className="text-lg font-bold text-white">
                              {batch.remaining_count} / {batch.total_count}
                            </span>
                          </div>
                          <div className="h-10 w-px bg-zinc-800"></div>
                          <div>
                            <span className="text-xs text-zinc-500 block mb-1">💰 Price</span>
                            <span className="text-lg font-serif text-yellow-500">
                              {batch.price_per_session.toLocaleString()}
                              <span className="text-xs ml-1">원</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isInUse ? 'bg-yellow-600' : 'bg-zinc-700'}`}
                        style={{ width: `${(batch.remaining_count / batch.total_count) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border border-zinc-800 rounded-lg bg-zinc-950">
              <CreditCard size={40} className="mx-auto mb-3 opacity-20 text-zinc-600" />
              <p className="text-sm text-zinc-500 mb-1">No detailed purchase history available</p>
              {u.remaining_sessions > 0 && (
                <p className="text-xs text-zinc-600">(Showing legacy balance: {u.remaining_sessions} sessions)</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-yellow-500" />
            Add New Session Pack
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Sessions to Add</label>
              <input
                type="number"
                placeholder="예: 10"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-yellow-600 outline-none transition-colors"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Unit Price (KRW)</label>
              <input
                type="number"
                placeholder="예: 50000"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-yellow-600 outline-none transition-colors"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleAddSession}
            disabled={loading}
            className="w-full bg-yellow-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-yellow-500 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '처리 중...' : 'ADD SESSION PACK'}
          </button>

          <p className="text-xs text-zinc-500 flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
            <span>새 티켓이 추가되며, 가장 오래된 티켓부터 소진됩니다 (FIFO)</span>
          </p>
        </div>

        <div className="pt-6 border-t border-zinc-800 space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Goal</label>
            <p className="text-sm text-zinc-300 bg-zinc-900 p-3 rounded-lg border border-zinc-800">{u.goal || '등록된 목표가 없습니다.'}</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Birth</label>
              <p className="text-sm text-zinc-300">{u.dob || '-'}</p>
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Gender</label>
              <p className="text-sm text-zinc-300">{u.gender === 'M' ? 'Male' : 'Female'}</p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2">🔒 SECRET CRM (Private)</h3>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="회원의 특이사항, 성취도 분석, 재등록 전략을 기록하세요."
            rows={6}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-500 focus:border-yellow-600 outline-none transition-colors resize-none"
          />
          <button
            onClick={handleSaveNote}
            disabled={isSavingNote}
            className="w-full bg-zinc-800 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {isSavingNote ? '저장 중...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberDetail;
