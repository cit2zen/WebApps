export interface Variable {
  symbol: string;      // "k"
  name: string;        // "용수철 상수"
  unit: string;        // "N/m"
  definition: string;
}

export interface Formula {
  latex: string;       // "E = \\frac{1}{2}kA^2"
  variables: Variable[];
}

export interface SliderConfig {
  variable: string;   // "A"
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ChartConfig {
  config: Record<string, unknown>; // Chart.js config object
  sliders: SliderConfig[];
}

export interface Term {
  word: string;        // 본문 내 하이라이트할 단어
  definition: string;
  formula?: string;    // 선택적 LaTeX
}

export interface SRSCardInput {
  category: string;   // "물리"
  topic: string;      // "역학"
  front: string;
  back: string;
}

export interface StructuredResponse {
  intuitive: string;   // 직관 요약 (마크다운)
  detailed: string;    // 상세 설명 (마크다운)
  formulas: Formula[];
  charts: ChartConfig[];
  terms: Term[];
  srs: SRSCardInput;
}

// DB row types
export interface Session {
  id: string;
  title: string;
  created_at: string;
}

export interface NodeRow {
  id: string;
  session_id: string;
  parent_id: string | null;
  thread_id: string | null;
  question: string;
  response: StructuredResponse;
  created_at: string;
}

export interface Thread {
  id: string;
  parent_node_id: string;
  label: string;
  created_at: string;
}

export interface SRSCard {
  id: string;
  node_id: string;
  front: string;
  back: string;
  category: string;
  topic: string;
  due_date: string;
  interval: number;
  ease_factor: number;
}

// 트리 조회용 (GET /api/session/[id]/tree)
export interface TreeNode {
  node: NodeRow;
  threads: TreeThread[];
}

export interface TreeThread {
  thread: Thread;
  chain: TreeNode[];  // 이 thread 안의 Q&A 체인 (각각 sub-threads 포함)
}
