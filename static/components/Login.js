export default {
    name: "Login",
    data() {
        return {
            email: "",
            password: "",
            errorMsg: "",
            submitting: false
        }
    },
    methods: {
        async handleLogin() {
            this.errorMsg = ""
            if (!this.email || !this.password) {
                this.errorMsg = "Please fill in all fields"
                return
            }

            this.submitting = true
            try {
                const response = await fetch("/api/sign-in", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: this.email,
                        password: this.password
                    })
                })
                const result = await response.json()

                if (!response.ok) {
                    this.errorMsg = result.error || "Login failed"
                    return
                }

                // Persist user role and name to keep session state across page refreshes
                localStorage.setItem("user-role", result.roles[0] || "")
                localStorage.setItem("user-name", result.name)

                // Alert the navbar component to refresh and display the correct menu links
                window.dispatchEvent(new Event("auth-changed"))

                // Direct the user to their respective dashboard depending on their assigned role
                if (result.roles.includes("admin")) {
                    this.$router.push("/admin")
                } else if (result.roles.includes("staff")) {
                    this.$router.push("/staff")
                } else {
                    this.$router.push("/trekker")
                }

            } catch (err) {
                this.errorMsg = "Something went wrong during login"
            } finally {
                this.submitting = false
            }
        }
    },
    template: `
        <div class="row justify-content-center mt-5">
            <div class="col-md-5">
                <div class="card p-4 shadow-sm">
                    <h3 class="text-center mb-4">Login</h3>
                    <div class="alert alert-danger" v-if="errorMsg">{{ errorMsg }}</div>
                    <div class="mb-3">
                        <label class="form-label">Email Address</label>
                        <input type="email" class="form-control" v-model="email" placeholder="name@email.com">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-control" v-model="password" placeholder="••••••••">
                    </div>
                    <button class="btn btn-primary w-100" @click="handleLogin" :disabled="submitting">
                        {{ submitting ? 'Logging in...' : 'Sign In' }}
                    </button>
                    <div class="text-center mt-3">
                        <span>New trekker? </span>
                        <router-link to="/register">Register Here</router-link>
                    </div>
                </div>
            </div>
        </div>
    `
}
