import Avatar from './Avatar.jsx';

export default function Comment({ comment }) {
  return (
    <div className="comment">
      <Avatar name={comment.author} size={32} />
      <div className="comment-body">
        <b>{comment.author}</b>
        <time>{comment.time}</time>
        <p>{comment.text}</p>
      </div>
    </div>
  );
}
