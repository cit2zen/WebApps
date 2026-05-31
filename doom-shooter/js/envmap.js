import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function buildEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const env = new RoomEnvironment(0.04);
    const envTexture = pmrem.fromScene(env, 0.04).texture;

    pmrem.dispose();
    env.dispose();

    return envTexture;
}
