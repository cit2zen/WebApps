// app/api/session/[id]/tree/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { NodeRow, Thread, TreeNode, TreeThread } from '@/lib/types'

async function buildTree(nodes: NodeRow[], threads: Thread[], parentId: string | null): Promise<TreeNode[]> {
  const children = nodes.filter(n => n.parent_id === parentId && n.thread_id === null)
  return Promise.all(children.map(async node => {
    const nodeThreads = threads.filter(t => t.parent_node_id === node.id)
    const treeThreads: TreeThread[] = await Promise.all(nodeThreads.map(async thread => {
      const chainNodes = nodes.filter(n => n.thread_id === thread.id)
      const chain = await buildThreadChain(nodes, threads, chainNodes)
      return { thread, chain }
    }))
    return { node, threads: treeThreads }
  }))
}

async function buildThreadChain(allNodes: NodeRow[], allThreads: Thread[], chainNodes: NodeRow[]): Promise<TreeNode[]> {
  const sorted = [...chainNodes].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return Promise.all(sorted.map(async node => {
    const nodeThreads = allThreads.filter(t => t.parent_node_id === node.id)
    const treeThreads: TreeThread[] = await Promise.all(nodeThreads.map(async thread => {
      const subChain = allNodes.filter(n => n.thread_id === thread.id)
      const chain = await buildThreadChain(allNodes, allThreads, subChain)
      return { thread, chain }
    }))
    return { node, threads: treeThreads }
  }))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const nodes = await query<NodeRow>(`SELECT * FROM nodes WHERE session_id = $1 ORDER BY created_at`, [id])
    const threads = await query<Thread>(
      `SELECT t.* FROM threads t
       JOIN nodes n ON n.session_id = $1
       WHERE t.parent_node_id = n.id
       ORDER BY t.created_at`,
      [id]
    )
    const tree = await buildTree(nodes, threads, null)
    return NextResponse.json(tree)
  } catch (err) {
    console.error('/api/session/[id]/tree error:', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
