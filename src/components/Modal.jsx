export default function Modal({ isOpen, onClose, wide, children }) {
  return (
    <div className={'modal-overlay' + (isOpen ? ' active' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        {children}
      </div>
    </div>
  );
}
