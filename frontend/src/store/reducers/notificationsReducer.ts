import { SystemNotification } from '../../types/models'
import * as types from '../types'

export interface NotificationsState {
  notificationsList: SystemNotification[]
  unreadCount: number
  loading: boolean
}

const initialState: NotificationsState = {
  notificationsList: [],
  unreadCount: 0,
  loading: false,
}

export const notificationsReducer = (state = initialState, action: any): NotificationsState => {
  switch (action.type) {
    case types.FETCH_NOTIFICATIONS_REQUEST:
      return { ...state, loading: true }

    case types.FETCH_NOTIFICATIONS_SUCCESS: {
      const list: SystemNotification[] = action.payload.notifications
      return {
        ...state,
        loading: false,
        notificationsList: list,
        unreadCount: list.filter((n) => !n.read).length,
      }
    }

    case types.MARK_NOTIFICATION_READ_SUCCESS: {
      const list = state.notificationsList.map((n) => (n.id === action.payload.id ? { ...n, read: true } : n))
      return {
        ...state,
        notificationsList: list,
        unreadCount: list.filter((n) => !n.read).length,
      }
    }

    case types.MARK_ALL_NOTIFICATIONS_READ_SUCCESS: {
      const list = state.notificationsList.map((n) => ({ ...n, read: true }))
      return {
        ...state,
        notificationsList: list,
        unreadCount: 0,
      }
    }

    default:
      return state
  }
}
