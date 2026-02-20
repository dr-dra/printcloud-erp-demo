'use client';

import React, { useRef, useEffect } from 'react';

interface AutoExpandingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  maxRows?: number;
  minHeight?: number; // Option to specify exact minimum height in pixels
  disabled?: boolean;
  name?: string;
  id?: string;
  variant?: 'input' | 'textarea'; // New variant prop
  tabIndex?: number;
  enableBulletPoints?: boolean; // Enable bullet point functionality
}

export default function AutoExpandingTextarea({
  value,
  onChange,
  placeholder = '',
  className = '',
  minRows = 1,
  maxRows = 6,
  minHeight,
  disabled = false,
  name,
  id,
  variant = 'textarea',
  tabIndex,
  enableBulletPoints = false,
}: AutoExpandingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Bullet point utility functions
  const getBulletSymbol = (level: number): string => {
    const symbols = ['•', '◦', '▪'];
    return symbols[Math.min(level, symbols.length - 1)];
  };

  const getBulletIndent = (level: number): string => {
    return '  '.repeat(level); // 2 spaces per level
  };

  const parseBulletLine = (
    line: string,
  ): { isBullet: boolean; level: number; content: string; fullPrefix: string } => {
    // Match bullet patterns with indentation
    const bulletMatch = line.match(/^(\s*)(•|◦|▪|-)\s(.*)$/);
    if (bulletMatch) {
      const indentStr = bulletMatch[1];
      const content = bulletMatch[3];
      const level = Math.floor(indentStr.length / 2);
      const fullPrefix = indentStr + getBulletSymbol(level) + ' ';
      return { isBullet: true, level, content, fullPrefix };
    }

    // Check for auto-detection patterns (- or • at start)
    const autoMatch = line.match(/^(\s*)(-|•)\s(.*)$/);
    if (autoMatch) {
      const indentStr = autoMatch[1];
      const level = Math.floor(indentStr.length / 2);
      const content = autoMatch[3];
      const fullPrefix = indentStr + getBulletSymbol(level) + ' ';
      return { isBullet: true, level, content, fullPrefix };
    }

    return { isBullet: false, level: 0, content: line, fullPrefix: '' };
  };

  const getCurrentLineInfo = (textarea: HTMLTextAreaElement) => {
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];
    const allLines = value.split('\n');

    return {
      currentLineIndex,
      currentLine,
      allLines,
      cursorPos,
      isAtLineStart: cursorPos === textBeforeCursor.lastIndexOf('\n') + 1,
      isAtLineEnd: cursorPos === value.indexOf('\n', cursorPos) || cursorPos === value.length,
    };
  };

  const insertBulletPoint = (level: number = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { currentLineIndex, allLines, cursorPos } = getCurrentLineInfo(textarea);
    const indent = getBulletIndent(level);
    const bullet = getBulletSymbol(level);
    const bulletPrefix = indent + bullet + ' ';

    // If we're at the start of an empty line or the line only has whitespace
    const currentLine = allLines[currentLineIndex];
    if (!currentLine.trim()) {
      // Replace the current line with bullet
      allLines[currentLineIndex] = bulletPrefix;
    } else {
      // Insert bullet at cursor position
      const textBeforeCursor = value.substring(0, cursorPos);
      const textAfterCursor = value.substring(cursorPos);
      const newValue = textBeforeCursor + bulletPrefix + textAfterCursor;
      onChange(newValue);

      // Set cursor position after the bullet
      setTimeout(() => {
        textarea.setSelectionRange(
          cursorPos + bulletPrefix.length,
          cursorPos + bulletPrefix.length,
        );
        textarea.focus();
      }, 0);
      return;
    }

    const newValue = allLines.join('\n');
    onChange(newValue);

    // Set cursor position after the bullet
    setTimeout(() => {
      const newCursorPos =
        currentLineIndex === 0
          ? bulletPrefix.length
          : allLines.slice(0, currentLineIndex).join('\n').length + 1 + bulletPrefix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate line height based on font size and line height
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;

    // Calculate min and max heights based on rows or explicit pixel values
    const calculatedMinHeight = minHeight || lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;

    // Get the scroll height (content height)
    const scrollHeight = textarea.scrollHeight;

    // Determine the new height
    let newHeight = Math.max(scrollHeight, calculatedMinHeight);
    newHeight = Math.min(newHeight, maxHeight);

    // Apply the new height
    textarea.style.height = `${newHeight}px`;

    // Show scrollbar if content exceeds max height
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  // Adjust height when value changes
  useEffect(() => {
    adjustHeight();
  }, [value, minRows, maxRows, minHeight]);

  // Adjust height on mount
  useEffect(() => {
    adjustHeight();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newValue = e.target.value;

    // Auto-detect bullet points when user types "- " or "• " at start of line
    if (enableBulletPoints) {
      const lines = newValue.split('\n');
      let modified = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if line starts with "- " or "• " and convert to proper bullet
        const autoMatch = line.match(/^(\s*)(-|•)\s(.*)$/);
        if (autoMatch) {
          const indentStr = autoMatch[1];
          const content = autoMatch[3];
          const level = Math.floor(indentStr.length / 2);
          const bullet = getBulletSymbol(level);
          lines[i] = indentStr + bullet + ' ' + content;
          modified = true;
        }
      }

      if (modified) {
        newValue = lines.join('\n');
      }
    }

    onChange(newValue);
    // Use setTimeout to ensure the state update is processed before adjusting height
    setTimeout(adjustHeight, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!enableBulletPoints) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const { currentLine, currentLineIndex, allLines, cursorPos } = getCurrentLineInfo(textarea);
    const bulletInfo = parseBulletLine(currentLine);

    // Ctrl+Shift+L (or Cmd+Shift+L) - Toggle bullet point
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      if (bulletInfo.isBullet) {
        // Remove bullet - convert to regular text
        const newContent = bulletInfo.content;
        allLines[currentLineIndex] = newContent;
        const newValue = allLines.join('\n');
        onChange(newValue);

        // Adjust cursor position
        setTimeout(() => {
          const lineStart =
            currentLineIndex === 0 ? 0 : allLines.slice(0, currentLineIndex).join('\n').length + 1;
          const newCursorPos = lineStart + newContent.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      } else {
        // Add bullet point
        insertBulletPoint(0);
      }
      return;
    }

    // Enter key - Handle bullet continuation
    if (e.key === 'Enter') {
      if (bulletInfo.isBullet) {
        e.preventDefault();

        // If current bullet is empty, remove it and exit bullet mode
        if (!bulletInfo.content.trim()) {
          allLines[currentLineIndex] = '';
          const newValue = allLines.join('\n');
          onChange(newValue);

          setTimeout(() => {
            const lineStart =
              currentLineIndex === 0
                ? 0
                : allLines.slice(0, currentLineIndex).join('\n').length + 1;
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }

        // Create new bullet point on next line with same level
        const indent = getBulletIndent(bulletInfo.level);
        const bullet = getBulletSymbol(bulletInfo.level);
        const newBulletLine = indent + bullet + ' ';

        // Insert new line with bullet
        const textBeforeCursor = value.substring(0, cursorPos);
        const textAfterCursor = value.substring(cursorPos);
        const newValue = textBeforeCursor + '\n' + newBulletLine + textAfterCursor;
        onChange(newValue);

        // Set cursor after the new bullet
        setTimeout(() => {
          const newCursorPos = cursorPos + 1 + newBulletLine.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        return;
      }
    }

    // Tab key - Indent bullet (create sub-bullet)
    if (e.key === 'Tab' && bulletInfo.isBullet) {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift+Tab - Outdent (decrease level)
        if (bulletInfo.level > 0) {
          const newLevel = bulletInfo.level - 1;
          const newIndent = getBulletIndent(newLevel);
          const newBullet = getBulletSymbol(newLevel);
          const newLine = newIndent + newBullet + ' ' + bulletInfo.content;

          allLines[currentLineIndex] = newLine;
          const newValue = allLines.join('\n');
          onChange(newValue);

          setTimeout(() => {
            const lineStart =
              currentLineIndex === 0
                ? 0
                : allLines.slice(0, currentLineIndex).join('\n').length + 1;
            const newCursorPos =
              lineStart + newIndent.length + newBullet.length + 1 + bulletInfo.content.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        }
      } else {
        // Tab - Indent (increase level, max 2 for 3 total levels: 0, 1, 2)
        if (bulletInfo.level < 2) {
          const newLevel = bulletInfo.level + 1;
          const newIndent = getBulletIndent(newLevel);
          const newBullet = getBulletSymbol(newLevel);
          const newLine = newIndent + newBullet + ' ' + bulletInfo.content;

          allLines[currentLineIndex] = newLine;
          const newValue = allLines.join('\n');
          onChange(newValue);

          setTimeout(() => {
            const lineStart =
              currentLineIndex === 0
                ? 0
                : allLines.slice(0, currentLineIndex).join('\n').length + 1;
            const newCursorPos =
              lineStart + newIndent.length + newBullet.length + 1 + bulletInfo.content.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
        }
      }
      return;
    }

    // Backspace - Remove bullet if at start of empty bullet line
    if (e.key === 'Backspace' && bulletInfo.isBullet) {
      const cursorRelativePos =
        cursorPos -
        (currentLineIndex === 0
          ? 0
          : value.split('\n').slice(0, currentLineIndex).join('\n').length + 1);

      // If cursor is at the start of the bullet content and content is empty
      if (cursorRelativePos <= bulletInfo.fullPrefix.length && !bulletInfo.content.trim()) {
        e.preventDefault();

        // Remove bullet, convert to regular text
        allLines[currentLineIndex] = '';
        const newValue = allLines.join('\n');
        onChange(newValue);

        setTimeout(() => {
          const lineStart =
            currentLineIndex === 0 ? 0 : allLines.slice(0, currentLineIndex).join('\n').length + 1;
          textarea.setSelectionRange(lineStart, lineStart);
        }, 0);
        return;
      }
    }
  };

  // Define styles based on variant
  const getVariantStyles = () => {
    if (variant === 'input') {
      // Match Flowbite TextInput styling exactly
      return `
        w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
        bg-gray-50 text-gray-900 placeholder-gray-500
        focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        dark:bg-gray-700 dark:border-gray-600 dark:text-white 
        dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500
        resize-none transition-all duration-200 ease-in-out
        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        dark:disabled:bg-gray-800 dark:disabled:text-gray-400
      `.trim();
    } else {
      // Original textarea styling
      return `
        w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg
        bg-white text-gray-900 placeholder-gray-500
        focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
        dark:bg-gray-700 dark:border-gray-600 dark:text-white 
        dark:placeholder-gray-400 dark:focus:ring-cyan-500 dark:focus:border-cyan-500
        resize-none transition-all duration-200 ease-in-out
        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        dark:disabled:bg-gray-800 dark:disabled:text-gray-400
      `.trim();
    }
  };

  // Calculate minHeight based on variant
  const getMinHeight = () => {
    if (minHeight) return `${minHeight}px`;

    if (variant === 'input') {
      // Match TextInput height calculation (py-2 = 8px top + 8px bottom)
      return `${20 * minRows + 16}px`;
    } else {
      // Original textarea calculation (py-1.5 = 6px top + 6px bottom)
      return `${20 * minRows + 12}px`;
    }
  };

  return (
    <textarea
      ref={textareaRef}
      id={id}
      name={name}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`${getVariantStyles()} ${className}`}
      style={{
        minHeight: getMinHeight(),
        overflow: 'hidden',
      }}
      tabIndex={tabIndex}
    />
  );
}
