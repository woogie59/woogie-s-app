import React, { createContext, useContext, useState, useCallback } from 'react';
import GlobalModal from '../components/GlobalModal';

const GlobalModalContext = createContext(null);

export const useGlobalModal = () => {
  const ctx = useContext(GlobalModalContext);
  if (!ctx) {
    throw new Error('useGlobalModal must be used within GlobalModalProvider');
  }
  return ctx;
};

export const GlobalModalProvider = ({ children }) => {
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: null,
    confirmLabel: null,
    cancelLabel: null,
    loading: false,
  });

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, isOpen: false, loading: false }));
  }, []);

  const showAlert = useCallback(({ title = '', message, confirmLabel }) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: null,
      onClose: closeModal,
      confirmLabel: confirmLabel ?? '확인',
      cancelLabel: null,
      loading: false,
    });
  }, [closeModal]);

  const showConfirm = useCallback(({ title = '', message, onConfirm, confirmLabel, cancelLabel }) => {
    const handleConfirm = async () => {
      if (typeof onConfirm !== 'function') {
        closeModal();
        return;
      }
      setModal((m) => ({ ...m, loading: true }));
      try {
        await onConfirm(closeModal);
        setModal((m) => ({ ...m, loading: false }));
        // Don't auto-close: caller may show a follow-up modal (e.g. success alert)
      } catch (err) {
        closeModal();
        showAlert({ message: err?.message || '오류가 발생했습니다.' });
      }
    };
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: handleConfirm,
      onClose: closeModal,
      confirmLabel: confirmLabel ?? '확인',
      cancelLabel: cancelLabel ?? '취소',
      loading: false,
    });
  }, [closeModal, showAlert]);

  const setLoading = useCallback((loading) => {
    setModal((m) => ({ ...m, loading }));
  }, []);

  const value = { showAlert, showConfirm, closeModal, setLoading };

  return (
    <GlobalModalContext.Provider value={value}>
      {children}
      <GlobalModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onClose={closeModal}
        confirmLabel={modal.confirmLabel}
        cancelLabel={modal.cancelLabel}
        loading={modal.loading}
      />
    </GlobalModalContext.Provider>
  );
};
