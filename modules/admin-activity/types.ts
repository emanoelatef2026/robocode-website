export const ACTIVITY_CATEGORIES = ['sessions','finance','people','groups','learning','security','system'] as const
export const ACTIVITY_PRIORITIES = ['urgent','action','info'] as const
export interface AdminActivity {
  id:string; actor_name:string; category:typeof ACTIVITY_CATEGORIES[number]; priority:typeof ACTIVITY_PRIORITIES[number];
  action:string; entity_type:string; entity_label:string; before_data:Record<string,unknown>; after_data:Record<string,unknown>;
  target_href:string; requires_action:boolean; resolved_at:string|null; created_at:string;
}
export interface ActivityFeed { events:AdminActivity[]; total:number }
export function activityTitle(action:string):string {
  return action.replaceAll('_',' ').replaceAll('.',' · ').replace(/\b\w/g,c=>c.toUpperCase())
}
