import { removeById, upsertById } from '@/lib/chat/message-state';

describe('chat message state helpers', () => {
  it('appends a new item when it does not exist yet', () => {
    expect(upsertById([{ id: 'one' }], { id: 'two' })).toEqual([{ id: 'one' }, { id: 'two' }]);
  });

  it('replaces an existing item without duplicating it', () => {
    expect(
      upsertById(
        [
          { id: 'one', body: 'old' },
          { id: 'two', body: 'keep' },
        ],
        { id: 'one', body: 'new' }
      )
    ).toEqual([
      { id: 'one', body: 'new' },
      { id: 'two', body: 'keep' },
    ]);
  });

  it('removes an item safely', () => {
    expect(
      removeById(
        [
          { id: 'one' },
          { id: 'two' },
        ],
        'one'
      )
    ).toEqual([{ id: 'two' }]);
  });
});
