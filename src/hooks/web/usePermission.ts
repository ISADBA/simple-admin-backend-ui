import type { RouteRecordRaw } from 'vue-router';

import { useAppStore } from '@/store/modules/app';
import { usePermissionStore } from '@/store/modules/permission';
import { useUserStore } from '@/store/modules/user';

import { useTabs } from './useTabs';

import { router, resetRouter } from '@/router';

import projectSetting from '@/settings/projectSetting';
import { PermissionModeEnum } from '@/enums/appEnum';
import { RoleEnum } from '@/enums/roleEnum';

import { useMultipleTabStore } from '@/store/modules/multipleTab';
import { intersection, isArray } from 'remeda';

// User permissions related operations
export function usePermission() {
  const userStore = useUserStore();
  const appStore = useAppStore();
  const permissionStore = usePermissionStore();
  const { closeAll } = useTabs(router);

  /**
   * Change permission mode
   */
  async function togglePermissionMode() {
    appStore.setProjectConfig({
      permissionMode:
        appStore.projectConfig?.permissionMode === PermissionModeEnum.BACK
          ? PermissionModeEnum.ROUTE_MAPPING
          : PermissionModeEnum.BACK,
    });
    location.reload();
  }

  /**
   * Reset and regain authority resource information
   * 重置和重新获得权限资源信息
   * @param id
   */
  async function resume() {
    const tabStore = useMultipleTabStore();
    tabStore.clearCacheTabs();
    resetRouter();
    const routes = await permissionStore.buildRoutesAction();
    routes.forEach((route) => {
      router.addRoute(route as unknown as RouteRecordRaw);
    });
    permissionStore.setLastBuildMenuTime();
    await closeAll();
  }

  /**
   * Determine whether there is permission
   */
  function hasPermission(value?: RoleEnum | RoleEnum[] | string | string[], def = true): boolean {
    // Visible by default
    if (!value) {
      return def;
    }

    const permMode = appStore.getProjectConfig.permissionMode;

    if ([PermissionModeEnum.ROUTE_MAPPING, PermissionModeEnum.ROLE].includes(permMode)) {
      if (!isArray(value)) {
        return userStore.getRoleList?.includes(value as RoleEnum);
      }
      return (intersection.multiset(value, userStore.getRoleList) as RoleEnum[]).length > 0;
    }

    if (PermissionModeEnum.BACK === permMode) {
      const allCodeList = permissionStore.getPermCodeList as string[];
      if (!isArray(value)) {
        const splits = ['||', '&&'];
        const splitName = splits.find((item) => value.includes(item));
        if (splitName) {
          const splitCodes = value.split(splitName);
          return splitName === splits[0]
            ? intersection.multiset(splitCodes, allCodeList).length > 0
            : intersection.multiset(splitCodes, allCodeList).length === splitCodes.length;
        }
        return allCodeList.includes(value);
      }
      return (intersection.multiset(value, allCodeList) as string[]).length > 0;
    }

    return true;
  }

  /**
   * Determine whether there is permission
   */
  function hasElementPermission(
    value?: string | string[],
    condition: 'AND' | 'OR' = 'OR',
  ): boolean {
    if (!value) {
      return false;
    }

    if (condition == 'OR') {
      if (isArray(value)) {
        for (const e of value) {
          if (permissionStore.getElementPermissionList.includes(e)) {
            return true;
          }
        }
      } else {
        if (permissionStore.getElementPermissionList.includes(value)) {
          return true;
        }
      }
    } else {
      if (isArray(value)) {
        for (const e of value) {
          if (!permissionStore.getElementPermissionList.includes(e)) {
            return false;
          }
        }
      } else {
        if (permissionStore.getElementPermissionList.includes(value)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Change roles
   * @param roles
   */
  async function changeRole(roles: RoleEnum | RoleEnum[]): Promise<void> {
    if (projectSetting.permissionMode !== PermissionModeEnum.ROUTE_MAPPING) {
      throw new Error(
        'Please switch PermissionModeEnum to ROUTE_MAPPING mode in the configuration to operate!',
      );
    }

    if (!isArray(roles)) {
      roles = [roles];
    }
    userStore.setRoleList(roles);
    await resume();
  }

  /**
   * refresh menu data
   */
  async function refreshMenu() {
    await resume();
  }

  return { changeRole, hasPermission, hasElementPermission, togglePermissionMode, refreshMenu };
}
