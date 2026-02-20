import React from 'react';

/**
 * Convert bullet points to HTML for display
 * Handles nested bullet lists with proper indentation
 */
export const convertBulletsToHtml = (text: string): React.ReactElement => {
  if (!text) return React.createElement('span', {});

  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  type ListItem = { level: number; items: React.ReactElement[] };
  let currentList: ListItem | null = null;
  let listStack: ListItem[] = [];

  lines.forEach((line, index) => {
    // Parse bullet line
    const bulletMatch = line.match(/^(\s*)(•|◦|▪)\s(.*)$/);

    if (bulletMatch) {
      const indentStr = bulletMatch[1];
      const content = bulletMatch[3];
      const level = Math.floor(indentStr.length / 2);

      // If this is the first bullet or we're at a different level
      if (!currentList || level !== currentList.level) {
        // If we have a current list and this level is deeper, push to stack
        if (currentList && level > currentList.level) {
          listStack.push(currentList);
        }
        // If this level is shallower, close previous lists
        else if (currentList && level < currentList.level) {
          // Close lists until we reach the right level
          while (listStack.length > 0 && listStack[listStack.length - 1].level >= level) {
            const closedList = listStack.pop()!;
            elements.push(
              React.createElement(
                'ul',
                {
                  key: `list-${elements.length}`,
                  className: 'list-disc list-inside ml-4 space-y-1',
                },
                closedList.items,
              ),
            );
          }
        }

        // Start new list
        currentList = { level, items: [] };
      }

      // Add item to current list
      currentList.items.push(
        React.createElement(
          'li',
          {
            key: `item-${index}`,
            className: `${level > 0 ? 'ml-4' : ''}`,
          },
          content,
        ),
      );
    } else if (line.trim()) {
      // Regular text line - close any open lists first
      if (currentList) {
        const list = currentList as ListItem;
        elements.push(
          React.createElement(
            'ul',
            { key: `list-${elements.length}`, className: 'list-disc list-inside ml-4 space-y-1' },
            list.items,
          ),
        );
        currentList = null;
      }

      // Add regular text
      elements.push(React.createElement('div', { key: `text-${index}` }, line));
    } else {
      // Empty line - add space if not in a list
      if (!currentList) {
        elements.push(React.createElement('div', { key: `space-${index}`, className: 'h-2' }));
      }
    }
  });

  // Close any remaining lists
  if (currentList) {
    const list = currentList as ListItem;
    elements.push(
      React.createElement(
        'ul',
        { key: `list-${elements.length}`, className: 'list-disc list-inside ml-4 space-y-1' },
        list.items,
      ),
    );
  }

  // Close any lists remaining in stack
  while (listStack.length > 0) {
    const closedList = listStack.pop()!;
    elements.push(
      React.createElement(
        'ul',
        { key: `list-${elements.length}`, className: 'list-disc list-inside ml-4 space-y-1' },
        closedList.items,
      ),
    );
  }

  return React.createElement('div', {}, elements);
};

/**
 * Format project description from first 3 item names
 */
export const formatProjectDescription = (
  items: Array<{ item?: string | null }> | undefined,
): string => {
  if (!items || items.length === 0) {
    return 'No items';
  }

  const itemNames = items
    .slice(0, 3)
    .map((item) => item.item)
    .filter((name): name is string => name !== undefined && name !== null && name.trim() !== '');

  if (itemNames.length === 0) {
    return 'No item names available';
  }

  // Remove duplicates while preserving order
  const uniqueNames: string[] = [];
  for (const name of itemNames) {
    if (!uniqueNames.includes(name)) {
      uniqueNames.push(name);
    }
  }

  if (uniqueNames.length <= 2) {
    return uniqueNames.join(' & ');
  } else {
    return uniqueNames.slice(0, 2).join(', ') + ' & ' + uniqueNames[2];
  }
};

/**
 * Render quotation status text
 */
export const renderQuotationStatus = (quotation: {
  is_active?: boolean;
  finalized?: boolean;
}): string => {
  if (!quotation.is_active) {
    return 'Inactive';
  }
  if (quotation.finalized) {
    return 'Finalized';
  }
  return 'Draft';
};
