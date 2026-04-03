import React, { useState, useEffect } from 'react';
import { CreditCard, History, Plus, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import AddSessionModal from './AddSessionModal';

const MemberDetail = ({ selectedMemberId, goBack }) => {
  const [u, setU] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchMemberDetails = async () => {
    const { data: userData } = await supabase.from('profiles').select('*').eq('id', selectedMemberId).single();
    setU(userData);

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

    setLoadingBatches(false);
  };

  useEffect(() => {
    fetchMemberDetails();
  }, [selectedMemberId]);

  const totalRemaining =
    batches.length > 0 ? batches.reduce((sum, batch) => sum + batch.remaining_count, 0) : u?.remaining_sessions || 0;

  if (!u)
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center text-gray-500">Loading...</div>
    );

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 pb-20 relative">
      <BackButton onClick={goBack} label="Members" />

      <header className="flex items-center justify-center mb-6">
        <h2 className="text-lg font-serif text-emerald-600">{u?.name}</h2>
      </header>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border border-gray-200 relative overflow-hidden shadow-md">
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-gray-500 text-sm tracking-widest uppercase">Total Remaining</span>
              <span className="text-4xl font-serif text-emerald-600">{totalRemaining}</span>
            </div>
            <p className="text-gray-600 text-xs">{u.email}</p>
            {batches.length > 0 && (
              <p className="text-gray-600 text-xs mt-1">
                {batches.length} active ticket{batches.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard size={100} className="text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History size={16} className="text-emerald-600" />
            Active Session Packs
          </h3>

          {loadingBatches ? (
            <p className="text-gray-500 text-center py-6">Loading tickets...</p>
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
                    className={`bg-white rounded-lg p-4 transition-all ${
                      isInUse ? 'border-2 border-emerald-600/60 bg-emerald-600/5' : 'border border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={14} className={isInUse ? 'text-emerald-600' : 'text-gray-500'} />
                          <span className="text-sm text-gray-500">{batchDate}</span>
                          {isInUse && (
                            <span className="text-xs bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">IN USE</span>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">🎫 Status</span>
                            <span className="text-lg font-bold text-slate-900">
                              {batch.remaining_count} / {batch.total_count}
                            </span>
                          </div>
                          <div className="h-10 w-px bg-gray-200"></div>
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">💰 Price</span>
                            <span className="text-lg font-serif text-emerald-600">
                              {batch.price_per_session.toLocaleString()}
                              <span className="text-xs ml-1">원</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isInUse ? 'bg-emerald-600' : 'bg-gray-300'}`}
                        style={{ width: `${(batch.remaining_count / batch.total_count) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
              <CreditCard size={40} className="mx-auto mb-3 opacity-20 text-gray-400" />
              <p className="text-sm text-gray-600 mb-1">No detailed purchase history available</p>
              {u.remaining_sessions > 0 && (
                <p className="text-xs text-gray-600">(Showing legacy balance: {u.remaining_sessions} sessions)</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus size={16} className="text-emerald-600" />
            Add New Session Pack
          </h3>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
          >
            OPEN SESSION PACK FORM
          </button>

          <p className="text-xs text-gray-600 flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
            <span>계산은 시스템이 자동으로 수행해 입력 실수를 방지합니다. (Remaining, Price/Session 자동 계산)</span>
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <div className="flex gap-8 sm:gap-12">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 uppercase tracking-[0.2em] block mb-2">Birth</label>
              <p className="text-sm text-gray-800 font-light tracking-wide">{u.dob || '—'}</p>
            </div>
            <div className="w-px bg-gray-200 shrink-0 self-stretch min-h-[3rem]" aria-hidden />
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 uppercase tracking-[0.2em] block mb-2">Gender</label>
              <p className="text-sm text-gray-800 font-light tracking-wide">{u.gender === 'M' ? 'Male' : 'Female'}</p>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddSessionModal
          userId={selectedMemberId}
          onClose={() => setShowAddModal(false)}
          onSaved={fetchMemberDetails}
        />
      )}

    </div>
  );
};

export default MemberDetail;
