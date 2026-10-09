export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/activities/index',
    'pages/profile/index',
    'pages/trip/index',
    'pages/signup/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#151817',
    navigationBarTitleText: '鹿友自驾俱乐部',
    navigationBarTextStyle: 'white'
  },
  permission: {
    'scope.userLocation': {
      desc: '用于计算更合理的车主与搭车集合距离'
    }
  },
  tabBar: {
    color: '#8A8E89',
    selectedColor: '#E98928',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/activities/index',
        text: '活动',
        iconPath: 'assets/tabbar/activities.png',
        selectedIconPath: 'assets/tabbar/activities-selected.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tabbar/profile.png',
        selectedIconPath: 'assets/tabbar/profile-selected.png'
      }
    ]
  }
})
