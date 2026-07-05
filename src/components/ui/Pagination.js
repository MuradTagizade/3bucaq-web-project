'use client';

import styles from './Pagination.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className={styles.pagination}>
      <button
        className={styles.arrow}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous"
      >
        <ChevronLeft size={18} />
      </button>

      {start > 1 && (
        <>
          <button className={styles.page} onClick={() => onPageChange(1)}>1</button>
          {start > 2 && <span className={styles.dots}>...</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          className={`${styles.page} ${page === currentPage ? styles.active : ''}`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className={styles.dots}>...</span>}
          <button className={styles.page} onClick={() => onPageChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        className={styles.arrow}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
