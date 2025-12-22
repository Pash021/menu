import React, { useEffect, useMemo } from "react";
import { List, useListCallbackRef } from "react-window";
import { MenuItemCard } from "./MenuItemCard";

function columnsForWidth(width) {
  if (width >= 960) return 4;
  if (width >= 640) return 3;
  return 2;
}

function gapForWidth(width) {
  return width >= 640 ? 14 : 12;
}

function extraHeightForWidth(width) {
  if (width >= 960) return 176;
  if (width >= 640) return 168;
  return 156;
}

const Row = React.memo(function Row({
  ariaAttributes,
  index,
  style,
  items,
  columns,
  gap,
  cardHeight,
  onOpenDish,
  activeDishId,
}) {
  const start = index * columns;
  const rowItems = (items || []).slice(start, start + columns);

  return (
    <div {...ariaAttributes} style={{ ...style, paddingBottom: gap, boxSizing: "border-box" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
          height: cardHeight,
          alignItems: "stretch",
        }}
      >
        {rowItems.map((dish) => (
          <MenuItemCard
            key={dish.id}
            dish={dish}
            onOpen={onOpenDish}
            isSharedActive={activeDishId != null && Number(dish?.id) === Number(activeDishId)}
          />
        ))}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.index === next.index &&
    prev.items === next.items &&
    prev.columns === next.columns &&
    prev.gap === next.gap &&
    prev.cardHeight === next.cardHeight &&
    prev.onOpenDish === next.onOpenDish &&
    prev.activeDishId === next.activeDishId &&
    prev.style?.top === next.style?.top &&
    prev.style?.left === next.style?.left &&
    prev.style?.width === next.style?.width &&
    prev.style?.height === next.style?.height
  );
});

export const VirtualizedDishGrid = React.memo(function VirtualizedDishGrid({
  items,
  width,
  height,
  onOpenDish,
  activeDishId,
  outerRef,
  className,
  paddingTop = 14,
  paddingBottom = 14,
}) {
  const columns = useMemo(() => columnsForWidth(width), [width]);
  const gap = useMemo(() => gapForWidth(width), [width]);
  const [listApi, setListApi] = useListCallbackRef(null);

  useEffect(() => {
    if (!outerRef) return undefined;
    const el = listApi?.element || null;
    outerRef(el);
    return () => outerRef(null);
  }, [listApi, outerRef]);

  const cardWidth = useMemo(() => {
    if (!width) return 0;
    const totalGap = gap * (columns - 1);
    return Math.max(120, Math.floor((width - totalGap) / columns));
  }, [columns, gap, width]);

  const cardHeight = useMemo(() => {
    if (!cardWidth) return 0;
    return cardWidth + extraHeightForWidth(width);
  }, [cardWidth, width]);

  const rowHeight = useMemo(() => cardHeight + gap, [cardHeight, gap]);
  const rowCount = useMemo(() => Math.ceil((items?.length || 0) / columns), [columns, items?.length]);

  const rowProps = useMemo(
    () => ({
      items: items || [],
      columns,
      gap,
      cardHeight,
      onOpenDish,
      activeDishId,
    }),
    [activeDishId, cardHeight, columns, gap, items, onOpenDish]
  );

  if (!width || !height || !items?.length) return null;

  return (
    <List
      className={className}
      listRef={setListApi}
      rowComponent={Row}
      rowProps={rowProps}
      rowCount={rowCount}
      rowHeight={rowHeight}
      overscanCount={2}
      style={{
        height,
        width,
        overflowX: "hidden",
        paddingTop,
        paddingBottom,
      }}
    />
  );
});
