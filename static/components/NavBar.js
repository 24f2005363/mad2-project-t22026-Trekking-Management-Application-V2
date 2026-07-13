export default {
    name: "NavBar",
    data() {
        return {
            currentRole: localStorage.getItem("user-role"),
            userName: localStorage.getItem("user-name")
        }
    },
    created() {
        window.addEventListener("auth-changed", () => {
            this.currentRole = localStorage.getItem("user-role")
            this.userName = localStorage.getItem("user-name")
        })
    },
    methods: {
        async logoutUser() {
            try {
                await fetch("/api/sign-out")
            } catch (err) {
                console.log("Logout API call error")
            }
            localStorage.clear()
            window.dispatchEvent(new Event("auth-changed"))
            this.$router.push("/")
        }
    },
    template: `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
            <div class="container">
                <router-link class="navbar-brand fw-bold" to="/">Trekking App</router-link>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navContent">
                    <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                        <!-- Admin -->
                        <li class="nav-item dropdown" v-if="currentRole === 'admin'">
                            <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">Admin Panel</a>
                            <ul class="dropdown-menu">
                                <li><router-link class="dropdown-item" to="/admin">Dashboard</router-link></li>
                            </ul>
                        </li>
                        <!-- Staff -->
                        <li class="nav-item" v-if="currentRole === 'staff'">
                            <router-link class="nav-link" to="/staff">Dashboard</router-link>
                        </li>
                        <li class="nav-item" v-if="currentRole === 'staff'">
                            <router-link class="nav-link" to="/staff/settings">Settings</router-link>
                        </li>
                        <!-- Trekker -->
                        <li class="nav-item" v-if="currentRole === 'trekker'">
                            <router-link class="nav-link" to="/trekker">Dashboard</router-link>
                        </li>
                    </ul>
                    <div class="d-flex align-items-center" v-if="currentRole">
                        <span class="text-light me-3 small">Logged in as: {{ userName }} ({{ currentRole }})</span>
                        <button class="btn btn-outline-danger btn-sm" @click="logoutUser">Logout</button>
                    </div>
                    <div class="d-flex align-items-center" v-else>
                        <router-link class="btn btn-outline-light btn-sm me-2" to="/">Login</router-link>
                        <router-link class="btn btn-outline-info btn-sm" to="/register">Register</router-link>
                    </div>
                </div>
            </div>
        </nav>
    `
}
