'use client';

import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import styles from './be-ui-otp-input.module.css';

export const EASE_OUT = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT = [0.77, 0, 0.175, 1];
export const EASE_DRAWER = [0.32, 0.72, 0, 1];

export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

export const SPRING_PRESS = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

export const SPRING_SWAP = {
  type: "spring",
  stiffness: 460,
  damping: 30,
  mass: 0.55,
};

export const SPRING_PANEL = {
  type: "spring",
  stiffness: 420,
  damping: 40,
  mass: 0.5,
};

export const SPRING_LAYOUT = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  mass: 0.6,
};

export const SPRING_MOUSE = {
  stiffness: 200,
  damping: 15,
  mass: 0.3,
};

export function OTPInput({
  length = 6,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onComplete,
  label,
  hint,
  successMessage,
  errorMessage,
  status = "idle",
  mask = false,
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel = "One-time passcode",
  className = "",
}) {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  const slotsRef = useRef(null);

  const controlled = controlledValue !== undefined;

  const [slots, setSlots] = useState(() =>
    toSlots(controlled ? controlledValue : defaultValue, length)
  );

  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  const joined = slots.join("");
  const joinedRef = useRef(joined);
  joinedRef.current = joined;

  useEffect(() => {
    if (!controlled) return;

    const incoming = sanitize(controlledValue, length);

    if (incoming !== joinedRef.current) {
      setSlots(toSlots(incoming, length));
    }
  }, [controlled, controlledValue, length]);

  const commit = (next) => {
    const wasComplete = slots.every((c) => c !== "");
    setSlots(next);

    const str = next.join("");

    onChange?.(str);

    if (!wasComplete && next.every((c) => c !== "")) {
      onComplete?.(str);
    }
  };

  const clearSlot = (idx) => {
    const next = [...slots];

    next[idx] = "";

    commit(next);
  };

  const slotFromClientX = (clientX) => {
    const els = slotsRef.current?.children;

    if (!els) return 0;

    for (let i = 0; i < els.length; i++) {
      if (clientX < els[i].getBoundingClientRect().right) return i;
    }

    return length - 1;
  };

  const insert = (raw, from = active) => {
    const digits = raw.replace(/\D/g, "");

    if (!digits) return;

    const next = [...slots];
    let i = from;

    for (const ch of digits) {
      if (i >= length) break;
      next[i] = ch;
      i++;
    }

    commit(next);
    setActive(Math.min(i, length - 1));
  };

  const onKeyDown = (e) => {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;

    const k = e.key;

    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      insert(k);
    } else if (k === "Backspace") {
      e.preventDefault();

      if (slots[active]) {
        clearSlot(active);
      } else if (active > 0) {
        clearSlot(active - 1);
        setActive(active - 1);
      }
    } else if (k === "Delete") {
      e.preventDefault();
      clearSlot(active);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (k === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, length - 1));
    } else if (k === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (k === "End") {
      e.preventDefault();
      setActive(length - 1);
    }
  };

  const onPaste = (e) => {
    if (disabled) return;

    e.preventDefault();
    insert(e.clipboardData.getData("text"), active);
  };

  const onChangeNative = (e) => {
    const digits = sanitize(e.target.value, length);

    if (!digits) return;

    commit(toSlots(digits, length));
    setActive(Math.min(digits.length, length - 1));
  };

  useEffect(() => {
    if (status !== "error" || reduce || !slotsRef.current) return;

    animate(
      slotsRef.current,
      {
        x: [0, -5, 5, -3, 3, -1, 0],
      },
      {
        duration: 0.45,
        ease: EASE_OUT,
      }
    );
  }, [status, reduce]);

  const showSuccess = status === "success";
  const activeIndex = focused ? active : -1;

  const message = showSuccess
    ? successMessage
    : status === "error"
      ? errorMessage
      : hint;

  return (
    <div className={`${styles.container} ${className}`}>
      {label ? (
        <label
          htmlFor={`${uid}-input`}
          className={styles.label}
        >
          {label}
        </label>
      ) : null}

      <div
        className={styles.inputWrapper}
        onMouseDown={(e) => {
          if (disabled) return;

          e.preventDefault();

          const firstEmpty = slots.indexOf("");
          const cap = firstEmpty === -1 ? length - 1 : firstEmpty;

          setActive(Math.min(slotFromClientX(e.clientX), cap));
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          id={`${uid}-input`}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={status === "error"}
          value=""
          maxLength={length}
          onKeyDown={onKeyDown}
          onChange={onChangeNative}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={styles.hiddenInput}
        />

        <div ref={slotsRef} className={styles.slotsContainer}>
          {Array.from({ length }, (_, i) => {
            const char = slots[i] ?? "";
            const isActive = i === activeIndex;

            return (
              <div
                key={`${uid}-${i}`}
                data-active={isActive}
                data-filled={char !== ""}
                className={`
                  ${styles.slot}
                  ${showSuccess ? styles.slot_success : ''}
                  ${status === 'error' && !showSuccess ? styles.slot_error : ''}
                  ${char && status !== 'error' && !showSuccess ? styles.slot_filled : ''}
                  ${isActive && !showSuccess && status !== 'error' ? styles.slot_active : ''}
                  ${disabled ? styles.slot_disabled : ''}
                `}
              >
                {isActive && !showSuccess ? (
                  <motion.span
                    aria-hidden
                    animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
                    transition={
                      reduce
                        ? undefined
                        : {
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                          }
                    }
                    className={`${styles.caret} ${char ? styles.caret_filled : styles.caret_empty}`}
                  />
                ) : null}

                <AnimatePresence initial={false}>
                  {char ? (
                    <motion.span
                      key={char}
                      initial={
                        reduce
                          ? { opacity: 0 }
                          : { y: 14, opacity: 0, filter: "blur(4px)" }
                      }
                      animate={
                        reduce
                          ? { opacity: 1 }
                          : { y: 0, opacity: 1, filter: "blur(0px)" }
                      }
                      exit={
                        reduce
                          ? { opacity: 0 }
                          : { y: -14, opacity: 0, filter: "blur(4px)" }
                      }
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.22, ease: EASE_OUT }
                      }
                      className={styles.char}
                    >
                      {mask ? "•" : char}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {showSuccess ? (
            <motion.span
              initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 500, damping: 28 }
              }
              className={styles.successIcon}
              aria-hidden
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Verified</title>
                <motion.path
                  d="M5 13l4 4L19 7"
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { duration: 0.35, ease: EASE_OUT, delay: 0.1 }
                  }
                />
              </svg>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {message ? (
        <p
          aria-live="polite"
          className={`
            ${styles.message}
            ${showSuccess ? styles.message_success : ''}
            ${status === 'error' && !showSuccess ? styles.message_error : ''}
            ${status !== 'error' && !showSuccess ? styles.message_hint : ''}
          `}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function sanitize(raw, length) {
  return (raw ?? "").replace(/\D/g, "").slice(0, length);
}

function toSlots(raw, length) {
  const digits = sanitize(raw, length);

  return Array.from({ length }, (_, i) => digits[i] ?? "");
}
