import Avatar from './Avatar.jsx';

// comment.avatar — необязательное поле: URL аватара автора комментария.
// Кто не передаёт его (старые вызовы), получает прежний вид — буквы на цветном фоне.
export default function Comment({ comment }) {
  return (
    <div className="comment">
      <Avatar name={comment.author} photo={comment.avatar} size={32} />
      <div className="comment-body">
        <b>{comment.author}</b>
        <time>{comment.time}</time>
        <p>{comment.text}</p>
      </div>
    </div>
  );
}
