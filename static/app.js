import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"

// Intercept all fetch calls to catch session expiration or invalid states.
// If the server returns a 401 Unauthorized but the frontend still thinks we're logged in,
// we clear local storage and redirect the user back to the login page to avoid a broken UI.
// We ignore 403 Forbidden because those are usually validation errors (like wrong password)
// and shouldn't trigger an automatic logout.
const rawFetch = window.fetch
window.fetch = async (...args) => {
    const response = await rawFetch(...args)
    if (response.status === 401 && localStorage.getItem("user-role")) {
        localStorage.clear()
        window.dispatchEvent(new Event("auth-changed"))
        if (window.location.hash !== "#/") {
            window.location.hash = "#/"
        }
    }
    return response
}

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

// Protect routes by checking the user's role before permitting navigation
router.beforeEach(async (to, from, next) => {
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

    // Confirm the backend session is still active. If the server restarted or the session
    // expired, local storage might be out of sync. This check prevents showing an empty
    // dashboard shell to users whose sessions have actually ended.
    if (to.meta.requiredRole && userRole) {
        try {
            const res = await rawFetch("/api/current-user")
            if (!res.ok) {
                localStorage.clear()
                window.dispatchEvent(new Event("auth-changed"))
                return next("/")
            }
        } catch (err) {
            // If the network call itself fails, we'll let the routing proceed and let individual component requests handle the error states
        }
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
