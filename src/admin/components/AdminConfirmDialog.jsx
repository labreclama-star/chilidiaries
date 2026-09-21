import Modal from '../../components/Modal.jsx';

export default function AdminConfirmDialog({ isOpen, title, message, confirmLabel = 'Удалить', onConfirm, onClose, danger = true }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>{title}</h2>
      {message && <p className="sub">{message}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="btn btn-ghost btn-block" onClick={onClose}>Отмена</button>
        <button
          className={'btn btn-block ' + (danger ? 'btn-primary' : 'btn-outline')}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
