(() => {
  function unwrap(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  function create(client) {
    if (!client) throw new Error('Supabase client is required.');

    return Object.freeze({
      async getRoomMembership(courseId, userId) {
        return unwrap(await client.from('course_room_members')
          .select('user_id')
          .eq('course_id', courseId)
          .eq('user_id', userId)
          .maybeSingle());
      },
      async joinRoom(courseId, userId, displayName) {
        return unwrap(await client.from('course_room_members')
          .insert({ course_id: courseId, user_id: userId, display_name: displayName })
          .select('course_id, user_id')
          .single());
      },
      async leaveRoom(courseId, userId) {
        return unwrap(await client.from('course_room_members')
          .delete()
          .eq('course_id', courseId)
          .eq('user_id', userId));
      },
      async listRoomMessages(courseId) {
        return unwrap(await client.from('course_room_messages')
          .select('id, course_id, user_id, display_name, body, created_at')
          .eq('course_id', courseId)
          .order('created_at', { ascending: true })
          .limit(100));
      },
      async sendRoomMessage(message) {
        return unwrap(await client.from('course_room_messages')
          .insert(message)
          .select('id, course_id, user_id, display_name, body, created_at')
          .single());
      },
      subscribeToRoomMessages(courseId, onMessage, onStatus) {
        return client.channel(`course-room-${courseId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'course_room_messages',
            filter: `course_id=eq.${courseId}`
          }, payload => onMessage(payload.new))
          .subscribe(onStatus);
      },
      async removeRoomChannel(channel) {
        const status = await client.removeChannel(channel);
        if (status !== 'ok') throw new Error(`Realtime channel cleanup failed: ${status}`);
      },
      async getActiveTracking(userId) {
        return unwrap(await client.from('tracking_sessions')
          .select('id, course_id, started_at, max_altitude_m')
          .eq('user_id', userId)
          .is('ended_at', null)
          .maybeSingle());
      },
      async listTrackingHistory(userId, startAt, endAt) {
        return unwrap(await client.from('tracking_sessions')
          .select('id, course_id, started_at, ended_at, max_altitude_m')
          .eq('user_id', userId)
          .not('ended_at', 'is', null)
          .gte('started_at', startAt)
          .lt('started_at', endAt)
          .order('started_at', { ascending: false }));
      },
      async startTracking(session) {
        return unwrap(await client.from('tracking_sessions')
          .insert(session)
          .select('id, course_id, started_at, max_altitude_m')
          .single());
      },
      async updateTrackingAltitude(sessionId, userId, altitude) {
        return unwrap(await client.from('tracking_sessions')
          .update({ max_altitude_m: altitude })
          .eq('id', sessionId)
          .eq('user_id', userId)
          .is('ended_at', null)
          .select('max_altitude_m')
          .single());
      },
      async finishTracking(sessionId, userId, updates) {
        return unwrap(await client.from('tracking_sessions')
          .update(updates)
          .eq('id', sessionId)
          .eq('user_id', userId)
          .is('ended_at', null)
          .select('id')
          .single());
      }
    });
  }

  window.TrailMateData = Object.freeze({ create });
})();
