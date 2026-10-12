import React, { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  replay?: boolean;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, format = (n) => String(Math.round(n)), duration = 1.2, className, replay }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: !replay });
  const [text, setText] = useState(format(0));
  const from = useRef(0);

  useEffect(() => {
    if (!inView) {
      if (replay) from.current = 0;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setText(format(v)),
    });
    from.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
};

export default AnimatedNumber;
