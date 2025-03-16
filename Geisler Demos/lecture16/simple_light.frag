precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform vec3 u_Light;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

void main() {
    if (u_FlatLighting) {
        // use a bright green "by default"
        gl_FragColor = vec4(0.0, 0.6, 0.2, 1.0);
    }
    else {
        // set every fragment to have the same "default" color
        vec3 baseColor = vec3(0.4, 0.0, 1.0);

        // convert our position into world space
        vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));

        // Apply our (slightly incorrect) transformation
        vec3 worldNormal = normalize(vec3(u_World * u_Model * vec4(v_Normal, 0.0)));

        // Get the direction between the light and our fragment
        vec3 lightDir = normalize(u_Light - worldPosition);

        gl_FragColor = vec4(dot(normalize(lightDir), worldNormal) * baseColor, 1.0);
    }
}