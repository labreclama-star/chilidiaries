import { useEffect, useRef, useState } from 'react';

/**
 * Wraps children in a div that fades/slides in once it scrolls into view.
 * Uses IntersectionObserver (cheap, no scroll listeners) and respects
 * prefers-reduced-motion via the .reveal CSS rule itself.
 */
export default function Reveal({ children, className = '', as: Tag = 'div', delay = 0, style, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mergedStyle = delay ? { ...style, transitionDelay: `${delay}ms` } : style;

  return (
    <Tag
      ref={ref}
      className={'reveal' + (inView ? ' in-view' : '') + (className ? ` ${className}` : '')}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}
