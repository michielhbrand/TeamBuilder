import { supabase } from '@/lib/supabase'
import { BOARD_SELECT, boardPatch, fail, mapBoard } from '@/lib/api-shared'
import type { BoardRow } from '@/lib/api-shared'
import type { Board, BoardInput } from '@/types/pipeline'

export async function fetchBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .order('name', { ascending: true })

  fail(error)

  return ((data ?? []) as unknown as BoardRow[]).map(mapBoard)
}

export async function fetchBoard(id: string): Promise<Board | undefined> {
  const { data, error } = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .eq('id', id)
    .maybeSingle()

  fail(error)

  return data ? mapBoard(data as unknown as BoardRow) : undefined
}

export async function createBoard(input: BoardInput): Promise<Board> {
  const { data, error } = await supabase.rpc('create_board', {
    p_name: input.name,
    p_department: input.department,
    p_deadline: input.deadline,
    p_open_positions: input.openPositions,
  })

  fail(error)

  const board = await fetchBoard(String(data))

  if (!board) {
    throw new Error('The board was created but could not be loaded.')
  }

  return board
}

export async function updateBoard(id: string, input: Partial<BoardInput>): Promise<void> {
  const patch = boardPatch(input)

  if (!Object.keys(patch).length) {
    return
  }

  const { error } = await supabase.from('boards').update(patch).eq('id', id)
  fail(error)
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id)
  fail(error)
}

export async function addBoardColumn(
  boardId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.rpc('add_board_column', {
    p_board_id: boardId,
    p_name: name,
  })

  fail(error)

  return { id: String(data), name }
}

export async function renameBoardColumn(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('board_columns').update({ name }).eq('id', id)
  fail(error)
}

export async function deleteBoardColumn(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_board_column', { p_column_id: id })
  fail(error)
}

export async function reorderBoardColumns(boardId: string, columnIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_board_columns', {
    p_board_id: boardId,
    p_column_ids: columnIds,
  })

  fail(error)
}
