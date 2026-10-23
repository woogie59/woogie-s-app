/** Only member-entered personal rows. PT attendance and coach reports are never touched. */
export async function deleteOwnPersonalWorkout(client, userId, entry) {
  if (!userId || !entry?.id || entry.kind !== 'personal') throw new Error('삭제할 개인운동 기록을 확인해 주세요.');
  const { data, error } = await client.from('member_workout_entries').delete()
    .eq('id', entry.id).eq('user_id', userId).eq('kind', 'personal').select('id');
  if (error || data?.length !== 1 || data[0].id !== entry.id) {
    throw new Error('삭제 결과를 확인하지 못했습니다. 기록을 다시 불러온 뒤 확인해 주세요.');
  }
  return entry.id;
}
