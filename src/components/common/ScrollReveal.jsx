import { useEffect, useRef, useState } from 'react';

const DIRECTION_CLASS = {
  up: 'reveal-up',
  down: 'reveal-down',
  left: 'reveal-left',
  right: 'reveal-right',
  fade: 'reveal-fade',
  scale: 'reveal-scale',
};

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  once = false,
  as: Tag = 'div',
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -48px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const dirClass = DIRECTION_CLASS[direction] || DIRECTION_CLASS.up;

  return (
    <Tag
      ref={ref}
      className={`reveal ${dirClass} ${visible ? 'reveal-visible' : ''} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

export function ScrollStagger({ children, className = '', direction = 'up', baseDelay = 0, stagger = 90 }) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <div className={className}>
      {items.map((child, index) => (
        <ScrollReveal
          key={child?.key ?? index}
          direction={direction}
          delay={baseDelay + index * stagger}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
