'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@platform/ui';
import { Save, RotateCcw, Plus, Trash2, X } from 'lucide-react';

type NodeData = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type ArrowData = {
  id: string;
  from: string;
  to: string;
  label: string;
};

type DiagramState = {
  nodes: NodeData[];
  arrows: ArrowData[];
};

type Posting = {
  amount: string;
  source: string;
  destination: string;
};

type Props = {
  postings: Posting[];
  txType: string;
  demoName: string;
  description?: string;
};

function formatAmount(amount: string): string {
  const match = amount.match(/([A-Z]+)\/(\d+)\s+(\d+)/);
  if (match && match[1] && match[2] && match[3]) {
    const currency = match[1];
    const decimals = parseInt(match[2], 10);
    const value = parseInt(match[3], 10);
    const actualValue = value / Math.pow(10, decimals);

    const symbols: Record<string, string> = {
      USD: '$',
      AUD: 'A$',
      BRL: 'R$',
      PHP: '₱',
    };

    const suffixes: Record<string, string> = {
      USDT: ' USDT',
      USDC: ' USDC',
      TSLA: ' TSLA',
      BTC: ' BTC',
      ETH: ' ETH',
    };

    const symbol = symbols[currency] || '';
    const suffix = suffixes[currency] || (symbol ? '' : ` ${currency}`);

    return `${symbol}${actualValue.toLocaleString()}${suffix}`;
  }
  return amount;
}

function getStorageKey(demoName: string, txType: string): string {
  return `flow-diagram-v2-${demoName}-${txType}`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Calculate width for node based on text
function calcNodeWidth(label: string): number {
  return Math.max(140, label.length * 9 + 32);
}

// Convert postings to initial diagram state
function postingsToInitialState(postings: Posting[]): DiagramState {
  const nodes: NodeData[] = [];
  const arrows: ArrowData[] = [];
  const nodeMap = new Map<string, NodeData>();

  if (postings.length === 0) return { nodes, arrows };

  // Build graph for layout
  const outflows = new Map<string, string[]>();
  const inflows = new Map<string, string[]>();

  for (const p of postings) {
    if (!outflows.has(p.source)) outflows.set(p.source, []);
    outflows.get(p.source)!.push(p.destination);
    if (!inflows.has(p.destination)) inflows.set(p.destination, []);
    inflows.get(p.destination)!.push(p.source);
  }

  // Find accounts that have bidirectional flow with @world (these are "sidecars")
  const worldSidecars = new Set<string>();
  for (const p of postings) {
    if (p.source === 'world' || p.destination === 'world') {
      const other = p.source === 'world' ? p.destination : p.source;
      const hasReverse = postings.some(
        r => (r.source === 'world' && r.destination === other) ||
             (r.destination === 'world' && r.source === other)
      );
      const hasBothDirections = postings.some(r => r.source === other && r.destination === 'world') &&
                                 postings.some(r => r.source === 'world' && r.destination === other);
      if (hasBothDirections) {
        worldSidecars.add(other);
      }
    }
  }

  // All accounts in the graph
  const allAccounts = new Set([...outflows.keys(), ...inflows.keys()]);

  // Check if @world should be in main tree (not a sidecar)
  // @world is a sidecar only when it has bidirectional flows with exchange accounts
  const worldInMainTree = allAccounts.has('world') && worldSidecars.size === 0;

  // Find roots
  const roots: string[] = [];

  // If @world is in main tree, has outflows, AND has no inflows, it's a root
  // (If @world has inflows, it's an intermediary, not a root)
  const worldInflows = inflows.get('world') || [];
  if (worldInMainTree && outflows.has('world') && (outflows.get('world')?.length || 0) > 0 && worldInflows.length === 0) {
    roots.push('world');
  }

  for (const account of allAccounts) {
    if (account === 'world') continue; // @world handled above
    const accountInflows = inflows.get(account) || [];
    // Root if no inflows, or only inflows from @world (when @world is in tree)
    if (accountInflows.length === 0 || (worldInMainTree && accountInflows.every(src => src === 'world'))) {
      // Don't add as root if it receives from @world and @world is a root
      if (worldInMainTree && accountInflows.includes('world')) {
        continue; // Will be added as level 1
      }
      roots.push(account);
    }
  }

  // BFS for levels
  const levels = new Map<string, number>();
  const queue = [...roots];
  for (const root of roots) levels.set(root, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;
    for (const to of outflows.get(current) || []) {
      // Skip @world if it's a sidecar
      if (to === 'world' && !worldInMainTree) continue;
      if (!levels.has(to)) {
        levels.set(to, currentLevel + 1);
        queue.push(to);
      }
    }
  }

  // Group by level
  const levelGroups = new Map<number, string[]>();
  for (const [account, level] of levels) {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(account);
  }

  // Create nodes with positions for main tree
  const nodeHeight = 44;
  const horizontalGap = 50;
  const verticalGap = 80;
  const startY = 40;
  const mainTreeCenterX = 350;

  for (const [level, accounts] of levelGroups) {
    let totalWidth = 0;
    for (const account of accounts) {
      totalWidth += calcNodeWidth(`@${account}`);
    }
    totalWidth += (accounts.length - 1) * horizontalGap;

    // Ensure startX is never negative (boxes don't fall off left side)
    const startX = Math.max(20, mainTreeCenterX - totalWidth / 2);
    let currentX = startX;

    for (const account of accounts) {
      const label = `@${account}`;
      const width = calcNodeWidth(label);
      const node: NodeData = {
        id: generateId(),
        label,
        x: currentX,
        y: startY + level * (nodeHeight + verticalGap),
      };
      nodes.push(node);
      nodeMap.set(account, node);
      currentX += width + horizontalGap;
    }
  }

  // Position @world as sidecar next to exchange accounts (only if not in main tree)
  if (allAccounts.has('world') && !worldInMainTree) {
    // Find the exchange account(s) that @world connects to bidirectionally
    let sidecarY = startY;
    let sidecarX = 650; // Default position to the right

    for (const exchangeAccount of worldSidecars) {
      const exchangeNode = nodeMap.get(exchangeAccount);
      if (exchangeNode) {
        sidecarY = exchangeNode.y; // Same Y level as the exchange
        sidecarX = exchangeNode.x + calcNodeWidth(exchangeNode.label) + 180; // To the right with more space
        break;
      }
    }

    const worldNode: NodeData = {
      id: generateId(),
      label: '@world',
      x: sidecarX,
      y: sidecarY,
    };
    nodes.push(worldNode);
    nodeMap.set('world', worldNode);
  }

  // Create arrows
  for (const p of postings) {
    const fromNode = nodeMap.get(p.source);
    const toNode = nodeMap.get(p.destination);
    if (fromNode && toNode) {
      arrows.push({
        id: generateId(),
        from: fromNode.id,
        to: toNode.id,
        label: formatAmount(p.amount),
      });
    }
  }

  return { nodes, arrows };
}

export function FlowDiagram({ postings, txType, demoName, description }: Props) {
  const storageKey = getStorageKey(demoName, txType);
  const initialState = useMemo(() => postingsToInitialState(postings), [postings]);

  const [state, setState] = useState<DiagramState>(initialState);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedArrow, setSelectedArrow] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingArrow, setEditingArrow] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasChanges, setHasChanges] = useState(false);
  const [creatingArrow, setCreatingArrow] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed: DiagramState = JSON.parse(saved);
        setState(parsed);
      } catch {
        setState(initialState);
      }
    } else {
      setState(initialState);
    }
  }, [storageKey, initialState]);

  // Focus input when editing
  useEffect(() => {
    if ((editingNode || editingArrow) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNode, editingArrow]);

  const nodeHeight = 44;

  const getNodeById = useCallback((id: string) => state.nodes.find(n => n.id === id), [state.nodes]);

  // Mouse handlers for dragging
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (editingNode) return;
    e.stopPropagation();

    if (creatingArrow) {
      // Complete arrow creation
      if (creatingArrow !== nodeId) {
        setState(prev => ({
          ...prev,
          arrows: [...prev.arrows, {
            id: generateId(),
            from: creatingArrow,
            to: nodeId,
            label: '$0',
          }],
        }));
        setHasChanges(true);
      }
      setCreatingArrow(null);
      return;
    }

    const node = getNodeById(nodeId);
    if (!node) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    setDragging(nodeId);
    setSelectedNode(nodeId);
    setSelectedArrow(null);
    setDragOffset({
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    });
  }, [creatingArrow, editingNode, getNodeById]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const newX = Math.max(0, e.clientX - rect.left - dragOffset.x);
    const newY = Math.max(0, e.clientY - rect.top - dragOffset.y);

    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === dragging ? { ...n, x: newX, y: newY } : n
      ),
    }));
    setHasChanges(true);
  }, [dragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setSelectedNode(null);
      setSelectedArrow(null);
      setCreatingArrow(null);
    }
  }, []);

  // Arrow selection
  const handleArrowClick = useCallback((arrowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedArrow(arrowId);
    setSelectedNode(null);
  }, []);

  // Editing handlers
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setEditingNode(nodeId);
  }, []);

  const handleArrowDoubleClick = useCallback((arrowId: string) => {
    setEditingArrow(arrowId);
  }, []);

  const handleNodeLabelChange = useCallback((nodeId: string, newLabel: string) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, label: newLabel } : n
      ),
    }));
    setHasChanges(true);
  }, []);

  const handleArrowLabelChange = useCallback((arrowId: string, newLabel: string) => {
    setState(prev => ({
      ...prev,
      arrows: prev.arrows.map(a =>
        a.id === arrowId ? { ...a, label: newLabel } : a
      ),
    }));
    setHasChanges(true);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingNode(null);
      setEditingArrow(null);
    }
  }, []);

  // CRUD operations
  const addNode = useCallback(() => {
    const newNode: NodeData = {
      id: generateId(),
      label: '@new:account',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100,
    };
    setState(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNode(newNode.id);
    setHasChanges(true);
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      setState(prev => ({
        nodes: prev.nodes.filter(n => n.id !== selectedNode),
        arrows: prev.arrows.filter(a => a.from !== selectedNode && a.to !== selectedNode),
      }));
      setSelectedNode(null);
      setHasChanges(true);
    } else if (selectedArrow) {
      setState(prev => ({
        ...prev,
        arrows: prev.arrows.filter(a => a.id !== selectedArrow),
      }));
      setSelectedArrow(null);
      setHasChanges(true);
    }
  }, [selectedNode, selectedArrow]);

  const startArrowCreation = useCallback(() => {
    if (selectedNode) {
      setCreatingArrow(selectedNode);
    }
  }, [selectedNode]);

  const handleSave = useCallback(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    setHasChanges(false);
  }, [state, storageKey]);

  const handleReset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState(initialState);
    setHasChanges(false);
    setSelectedNode(null);
    setSelectedArrow(null);
  }, [storageKey, initialState]);

  if (postings.length === 0 && state.nodes.length === 0) return null;

  // Calculate SVG dimensions
  let maxX = 800;
  let maxY = 400;
  for (const node of state.nodes) {
    const width = calcNodeWidth(node.label);
    maxX = Math.max(maxX, node.x + width + 40);
    maxY = Math.max(maxY, node.y + nodeHeight + 60);
  }

  const selectedNodeData = selectedNode ? getNodeById(selectedNode) : null;
  const selectedArrowData = selectedArrow ? state.arrows.find(a => a.id === selectedArrow) : null;

  return (
    <div className="space-y-3">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div className="border border-border rounded-lg overflow-hidden bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={addNode}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Box
            </Button>
            {selectedNode && (
              <Button
                variant="secondary"
                size="sm"
                onClick={startArrowCreation}
                className="h-7 text-xs"
                disabled={!!creatingArrow}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Arrow From
              </Button>
            )}
            {(selectedNode || selectedArrow) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                className="h-7 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
            {creatingArrow && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Click target node to create arrow
                <button onClick={() => setCreatingArrow(null)} className="hover:text-blue-800">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Double-click to edit text
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button
              variant={hasChanges ? 'primary' : 'secondary'}
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs"
              disabled={!hasChanges}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="p-4 overflow-auto" style={{ maxHeight: '500px' }}>
          <svg
            ref={svgRef}
            width={maxX}
            height={maxY}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleSvgClick}
            style={{ cursor: dragging ? 'grabbing' : creatingArrow ? 'crosshair' : 'default' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
              <marker
                id="arrowhead-selected"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
            </defs>

            {/* Draw arrows */}
            {state.arrows.map((arrow) => {
              const fromNode = getNodeById(arrow.from);
              const toNode = getNodeById(arrow.to);
              if (!fromNode || !toNode) return null;

              const fromWidth = calcNodeWidth(fromNode.label);
              const toWidth = calcNodeWidth(toNode.label);

              // Check if there's a reverse arrow (bidirectional)
              const hasReverseArrow = state.arrows.some(
                a => a.from === arrow.to && a.to === arrow.from
              );

              // Check if nodes are on same horizontal level (side by side)
              const sameLevel = Math.abs(fromNode.y - toNode.y) < 10;

              let fromX: number, fromY: number, toX: number, toY: number;

              if (hasReverseArrow && sameLevel) {
                // Horizontal bidirectional arrows for exchange pattern
                // One arrow goes above (with slight arc), one goes below
                const fromIsLeft = fromNode.x < toNode.x;
                const isForwardArrow = arrow.from < arrow.to;

                // Determine which arrow goes on top vs bottom based on direction
                // Arrow going left-to-right uses top path, right-to-left uses bottom
                const goingLeftToRight = (fromIsLeft && fromNode.id === arrow.from) ||
                                         (!fromIsLeft && toNode.id === arrow.from);
                const useTopPath = goingLeftToRight;

                const verticalOffset = 10;

                if (useTopPath) {
                  // Top arrow path
                  if (fromIsLeft) {
                    fromX = fromNode.x + fromWidth;
                    toX = toNode.x;
                  } else {
                    fromX = fromNode.x;
                    toX = toNode.x + toWidth;
                  }
                  fromY = fromNode.y + nodeHeight / 2 - verticalOffset;
                  toY = toNode.y + nodeHeight / 2 - verticalOffset;
                } else {
                  // Bottom arrow path
                  if (fromIsLeft) {
                    fromX = fromNode.x + fromWidth;
                    toX = toNode.x;
                  } else {
                    fromX = fromNode.x;
                    toX = toNode.x + toWidth;
                  }
                  fromY = fromNode.y + nodeHeight / 2 + verticalOffset;
                  toY = toNode.y + nodeHeight / 2 + verticalOffset;
                }
              } else if (hasReverseArrow) {
                // Vertical bidirectional - offset horizontally
                const isForwardArrow = arrow.from < arrow.to;
                const horizontalOffset = 20;

                fromX = fromNode.x + fromWidth / 2 + (isForwardArrow ? -horizontalOffset : horizontalOffset);
                fromY = fromNode.y + nodeHeight;
                toX = toNode.x + toWidth / 2 + (isForwardArrow ? -horizontalOffset : horizontalOffset);
                toY = toNode.y;
              } else {
                // Single direction arrow: center bottom to center top
                fromX = fromNode.x + fromWidth / 2;
                fromY = fromNode.y + nodeHeight;
                toX = toNode.x + toWidth / 2;
                toY = toNode.y;
              }

              const midX = (fromX + toX) / 2;
              const midY = (fromY + toY) / 2;

              const isSelected = selectedArrow === arrow.id;
              const isEditing = editingArrow === arrow.id;

              // Compact label sizing
              const labelWidth = Math.max(45, arrow.label.length * 6.5 + 10);
              const labelHeight = 16;

              // Check arrow orientation
              const isHorizontal = Math.abs(fromY - toY) < 20;

              // Determine if this is a top or bottom path for bidirectional
              const isTopPath = fromY < (fromNode.y + nodeHeight / 2);

              // Calculate label position - keep labels OFF the arrow lines
              let labelX: number;
              let labelY: number;

              if (hasReverseArrow && isHorizontal) {
                // Horizontal bidirectional: label above/below the arrow
                labelX = midX;
                if (isTopPath) {
                  labelY = fromY - 14; // Above top arrow
                } else {
                  labelY = fromY + 14; // Below bottom arrow
                }
              } else if (isHorizontal) {
                // Single horizontal arrow - centered above the line
                labelX = midX;
                labelY = midY - 14;
              } else {
                // Vertical arrows - centered above the line midpoint
                labelX = midX;
                labelY = midY - 12;
              }

              return (
                <g key={arrow.id} onClick={(e) => handleArrowClick(arrow.id, e)} style={{ cursor: 'pointer' }}>
                  {/* Straight lines for all arrows */}
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX - (isHorizontal ? 8 : 0)}
                    y2={toY - (isHorizontal ? 0 : 4)}
                    stroke={isSelected ? '#3b82f6' : '#9ca3af'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                  />
                  {isEditing ? (
                    <foreignObject x={labelX - labelWidth / 2} y={labelY - labelHeight / 2} width={labelWidth + 4} height={labelHeight + 4}>
                      <input
                        ref={inputRef}
                        type="text"
                        value={arrow.label}
                        onChange={(e) => handleArrowLabelChange(arrow.id, e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={() => setEditingArrow(null)}
                        className="w-full h-full text-center text-xs font-semibold bg-white border border-emerald-300 rounded outline-none"
                        style={{ color: '#166534', fontSize: '10px' }}
                      />
                    </foreignObject>
                  ) : (
                    <g onDoubleClick={() => handleArrowDoubleClick(arrow.id)} style={{ cursor: 'pointer' }}>
                      {/* Small background pill for label */}
                      <rect
                        x={labelX - labelWidth / 2}
                        y={labelY - labelHeight / 2}
                        width={labelWidth}
                        height={labelHeight}
                        rx="3"
                        fill="white"
                        stroke={isSelected ? '#3b82f6' : '#d1fae5'}
                        strokeWidth="1"
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="10"
                        fontWeight="600"
                        fill={isSelected ? '#3b82f6' : '#059669'}
                      >
                        {arrow.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Draw nodes */}
            {state.nodes.map((node) => {
              const isWorld = node.label === '@world';
              const isSelected = selectedNode === node.id;
              const isEditing = editingNode === node.id;
              const width = calcNodeWidth(node.label);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onDoubleClick={() => handleNodeDoubleClick(node.id)}
                  style={{ cursor: dragging === node.id ? 'grabbing' : 'grab' }}
                >
                  <rect
                    width={width}
                    height={nodeHeight}
                    rx="8"
                    fill={isWorld ? '#f8fafc' : isSelected ? '#dbeafe' : '#eff6ff'}
                    stroke={isSelected ? '#3b82f6' : isWorld ? '#94a3b8' : '#3b82f6'}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  {isEditing ? (
                    <foreignObject x="4" y="8" width={width - 8} height={nodeHeight - 16}>
                      <input
                        ref={inputRef}
                        type="text"
                        value={node.label}
                        onChange={(e) => handleNodeLabelChange(node.id, e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={() => setEditingNode(null)}
                        className="w-full h-full text-center text-sm bg-transparent border-none outline-none font-mono"
                        style={{ color: isWorld ? '#475569' : '#1e40af' }}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={width / 2}
                      y={nodeHeight / 2 + 5}
                      textAnchor="middle"
                      fontSize="13"
                      fontFamily="ui-monospace, monospace"
                      fill={isWorld ? '#475569' : '#1e40af'}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
