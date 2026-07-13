import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"

import NavBar from "./components/NavBar.js"
import Login from "./components/Login.js"
import Register from "./components/Register.js"
import AdminDashboard from "./components/AdminDashboard.js"
import StaffDashboard from "./components/StaffDashboard.js"
import StaffSettings from "./components/StaffSettings.js"
import TrekkerDashboard from "./components/TrekkerDashboard.js"

const routes = [
    { path: "/", component: Login, meta: { anonymous: true } },
    { path: "/register", component: Register, meta: { anonymous: true } },
    { path: "/admin", component: AdminDashboard, meta: { requiredRole: "admin" } },
    { path: "/staff", component: StaffDashboard, meta: { requiredRole: "staff" } },
    { path: "/staff/settings", component: StaffSettings, meta: { requiredRole: "staff" } },
    { path: "/trekker", component: TrekkerDashboard, meta: { requiredRole: "trekker" } },
    { path: "/:pathMatch(.*)*", redirect: "/" }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

// Route guard to check user roles
router.beforeEach((to, from, next) => {
    const userRole = localStorage.getItem("user-role")

    if (to.meta.anonymous && userRole) {
        if (userRole === "admin") return next("/admin")
        if (userRole === "staff") return next("/staff")
        if (userRole === "trekker") return next("/trekker")
    }

    if (to.meta.requiredRole && userRole !== to.meta.requiredRole) {
        if (!userRole) return next("/")
        if (userRole === "admin") return next("/admin")
        if (userRole === "staff") return next("/staff")
        if (userRole === "trekker") return next("/trekker")
    }

    next()
})

const App = {
    components: { NavBar },
    template: `
        <div>
            <nav-bar></nav-bar>
            <main class="container py-4">
                <router-view></router-view>
            </main>
        </div>
    `
}

const app = createApp(App)
app.use(router)
app.mount("#app")
